import type { Dispatch } from 'react';
import type { AssistantAction, AssistantState } from '@dadei/ui/types/assistant.types';
import type { ServiceMode } from '@dadei/ui/types/service.types';
import type { ServiceModeClaim } from '@dadei/ui/types/service.types';

/** Authoritative service snapshot from backend (`assistant_state` websocket / claim HTTP). */
export interface AssistantStateSnapshot {
  revision: number;
  ambientEnabled: boolean;
  commandModeActive: boolean;
  ownerSessionId: string | null;
  expiresAt: string | null;
}

export const MIC_INTENT_COOLDOWN_MS = 350;
export const SERVICE_STATE_SYNC_TIMEOUT_MS = 15_000;

let transitionChain: Promise<void> = Promise.resolve();
let lastAppliedRevision = 0;
let lastMicIntentAtMs = 0;

interface RevisionWaiter {
  minRevision: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const revisionWaiters: RevisionWaiter[] = [];

function rejectAllRevisionWaiters(error: Error) {
  while (revisionWaiters.length > 0) {
    const waiter = revisionWaiters.pop();
    if (!waiter) break;
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }
}

function notifyRevisionWaiters(revision: number) {
  for (let i = revisionWaiters.length - 1; i >= 0; i -= 1) {
    const waiter = revisionWaiters[i];
    if (revision > waiter.minRevision) {
      clearTimeout(waiter.timer);
      waiter.resolve();
      revisionWaiters.splice(i, 1);
    }
  }
}

export function resetAssistantLifecycle(): void {
  transitionChain = Promise.resolve();
  lastAppliedRevision = 0;
  lastMicIntentAtMs = 0;
  rejectAllRevisionWaiters(new Error('assistant_lifecycle_reset'));
}

export function getLastAppliedAssistantRevision(): number {
  return lastAppliedRevision;
}

export function deriveServiceModeFromSnapshot(snapshot: AssistantStateSnapshot): ServiceMode {
  if (snapshot.commandModeActive) return 'command';
  if (snapshot.ambientEnabled) return 'ambient';
  return 'off';
}

export function parseAssistantStateWireMessage(
  msg: Record<string, unknown>,
): AssistantStateSnapshot | null {
  if (msg.event !== 'assistant_state') return null;
  const revision = typeof msg.revision === 'number' ? msg.revision : Number(msg.revision);
  if (!Number.isFinite(revision)) return null;
  return {
    revision,
    ambientEnabled: msg.ambient_enabled === true,
    commandModeActive: msg.command_mode_active === true,
    ownerSessionId:
      typeof msg.owner_session_id === 'string' ? msg.owner_session_id : null,
    expiresAt: typeof msg.expires_at === 'string' ? msg.expires_at : null,
  };
}

export function snapshotFromServiceModeClaim(claim: ServiceModeClaim): AssistantStateSnapshot {
  return {
    revision: claim.revision,
    ambientEnabled: !claim.active,
    commandModeActive: claim.active,
    ownerSessionId: claim.owner_session_id,
    expiresAt: claim.expires_at,
  };
}

export function buildAssistantStateSyncAction(
  snapshot: AssistantStateSnapshot,
  state: AssistantState,
): AssistantAction {
  const nextServiceMode = deriveServiceModeFromSnapshot(snapshot);
  const wasCommand = state.serviceMode === 'command';
  const leavingCommand = wasCommand && nextServiceMode !== 'command';
  const enteringCommand = nextServiceMode === 'command' && !wasCommand;

  let commandState = state.commandState;
  let commandMode = state.commandMode;

  if (leavingCommand) {
    commandState = 'idle';
    commandMode = 'normal';
  } else if (enteringCommand) {
    if (commandState !== 'locked') {
      commandState = 'idle';
    }
  } else if (nextServiceMode === 'ambient') {
    if (commandState === 'idle' || commandState === 'locked') {
      commandState = 'idle';
    }
  }

  return {
    type: 'assistant_state/sync',
    revision: snapshot.revision,
    serviceMode: nextServiceMode,
    commandOwnerSessionId: snapshot.ownerSessionId,
    commandServiceExpiresAt: snapshot.expiresAt,
    commandState,
    commandMode,
  };
}

export function beginServiceStateSyncPending(
  dispatch: Dispatch<AssistantAction>,
  baselineRevision: number,
): void {
  dispatch({
    type: 'service_state/sync_pending',
    pending: true,
    baselineRevision,
  });
}

export function clearServiceStateSyncPending(dispatch: Dispatch<AssistantAction>): void {
  dispatch({ type: 'service_state/sync_pending', pending: false });
}

export function waitForServiceStateRevisionAfter(
  baselineRevision: number,
  timeoutMs: number = SERVICE_STATE_SYNC_TIMEOUT_MS,
): Promise<void> {
  if (lastAppliedRevision > baselineRevision) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const waiter: RevisionWaiter = {
      minRevision: baselineRevision,
      resolve,
      reject,
      timer: setTimeout(() => {
        const idx = revisionWaiters.indexOf(waiter);
        if (idx !== -1) revisionWaiters.splice(idx, 1);
        reject(new Error('service_state_sync_timeout'));
      }, timeoutMs),
    };
    revisionWaiters.push(waiter);
  });
}

/** Run a backend service mutation and block until the websocket snapshot lands. */
export async function runServiceStateMutation(options: {
  dispatch: Dispatch<AssistantAction>;
  baselineRevision: number;
  micPending?: boolean;
  mutation: () => Promise<void>;
}): Promise<void> {
  const { dispatch, baselineRevision, micPending = false, mutation } = options;
  if (micPending) {
    beginServiceStateSyncPending(dispatch, baselineRevision);
  }
  try {
    await mutation();
    await waitForServiceStateRevisionAfter(baselineRevision);
  } catch (error) {
    if (micPending) {
      clearServiceStateSyncPending(dispatch);
    }
    throw error;
  }
}

export function applyAssistantStateSnapshot(
  dispatch: Dispatch<AssistantAction>,
  snapshot: AssistantStateSnapshot,
  state: AssistantState,
): boolean {
  const syncAction = buildAssistantStateSyncAction(snapshot, state);
  if (snapshot.revision <= lastAppliedRevision) {
    if (
      state.serviceStateSyncPending &&
      lastAppliedRevision > (state.serviceStateSyncBaselineRevision ?? -1)
    ) {
      clearServiceStateSyncPending(dispatch);
    }
    return false;
  }
  lastAppliedRevision = snapshot.revision;
  dispatch(syncAction);
  notifyRevisionWaiters(snapshot.revision);
  return true;
}

export function runAssistantTransition<T>(fn: () => Promise<T>): Promise<T> {
  const run = transitionChain.then(fn);
  transitionChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function shouldAcceptMicIntent(nowMs: number = Date.now()): boolean {
  return nowMs - lastMicIntentAtMs >= MIC_INTENT_COOLDOWN_MS;
}

export function markMicIntentHandled(nowMs: number = Date.now()): void {
  lastMicIntentAtMs = nowMs;
}
