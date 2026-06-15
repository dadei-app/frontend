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

let transitionChain: Promise<void> = Promise.resolve();
let lastAppliedRevision = 0;
let lastMicIntentAtMs = 0;

export function resetAssistantLifecycle(): void {
  transitionChain = Promise.resolve();
  lastAppliedRevision = 0;
  lastMicIntentAtMs = 0;
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

export function applyAssistantStateSnapshot(
  dispatch: Dispatch<AssistantAction>,
  snapshot: AssistantStateSnapshot,
  state: AssistantState,
): boolean {
  const syncAction = buildAssistantStateSyncAction(snapshot, state);
  if (snapshot.revision <= lastAppliedRevision) {
    if (state.isTogglingService) {
      dispatch({ type: 'service/toggling', toggling: false });
    }
    return false;
  }
  lastAppliedRevision = snapshot.revision;
  dispatch(syncAction);
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

export function noteLocalAssistantRevision(revision: number): void {
  if (revision > lastAppliedRevision) {
    lastAppliedRevision = revision;
  }
}
