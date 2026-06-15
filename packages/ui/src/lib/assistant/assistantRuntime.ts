import type { AssistantBubbleStatus, CommandMode, CommandState } from '@dadei/ui/types/command.types';
import {
  INITIAL_ASSISTANT_STATE,
  type AssistantAction,
  type AssistantState,
} from '@dadei/ui/types/assistant.types';

function clearServiceStateSyncPending(state: AssistantState): AssistantState {
  return {
    ...state,
    serviceStateSyncPending: false,
    serviceStateSyncBaselineRevision: null,
  };
}

function clearCommandCaptureSyncPending(state: AssistantState): AssistantState {
  return { ...state, commandCaptureSyncPending: false };
}

export function assistantRuntimeReducer(
  state: AssistantState,
  action: AssistantAction,
): AssistantState {
  switch (action.type) {
    case 'network/connected':
      return { ...state, isConnected: true, registrationConflict: false };

    case 'network/disconnected':
      return {
        ...INITIAL_ASSISTANT_STATE,
        registrationConflict: state.registrationConflict,
      };

    case 'network/registration_conflict':
      return {
        ...INITIAL_ASSISTANT_STATE,
        registrationConflict: true,
      };

    case 'service_state/sync_pending':
      if (!action.pending) {
        return clearServiceStateSyncPending(state);
      }
      return {
        ...state,
        serviceStateSyncPending: true,
        serviceStateSyncBaselineRevision:
          action.baselineRevision ?? state.serviceStateRevision,
      };

    case 'command/capture_sync_pending':
      if (!action.pending) {
        return clearCommandCaptureSyncPending(state);
      }
      return { ...state, commandCaptureSyncPending: true };

    case 'assistant_state/sync': {
      if (action.revision <= state.serviceStateRevision) {
        if (
          state.serviceStateSyncPending &&
          state.serviceStateRevision >
            (state.serviceStateSyncBaselineRevision ?? -1)
        ) {
          return clearServiceStateSyncPending(state);
        }
        return state;
      }
      return clearServiceStateSyncPending({
        ...state,
        serviceStateRevision: action.revision,
        serviceMode: action.serviceMode,
        commandOwnerSessionId: action.commandOwnerSessionId,
        commandServiceExpiresAt: action.commandServiceExpiresAt,
        commandState: action.commandState,
        commandMode: action.commandMode,
      });
    }

    case 'command/state': {
      if (
        state.serviceMode !== 'command' &&
        action.commandState !== 'idle' &&
        action.commandState !== 'locked'
      ) {
        return state;
      }
      if (action.commandState === 'idle' || action.commandState === 'locked') {
        return {
          ...state,
          commandState: action.commandState,
          commandMode: action.commandState === 'idle' ? 'normal' : state.commandMode,
        };
      }
      return { ...state, serviceMode: 'command', commandState: action.commandState };
    }

    case 'command/mode':
      return { ...state, commandMode: action.commandMode };

    case 'command/thinking_active':
      return { ...state, commandThinkingActive: action.active };

    case 'runtime/reset':
      return { ...INITIAL_ASSISTANT_STATE };

    default:
      return state;
  }
}

export function selectIsServiceStateSyncPending(state: AssistantState): boolean {
  return state.serviceStateSyncPending;
}

export function selectIsCommandCaptureSyncPending(state: AssistantState): boolean {
  return state.commandCaptureSyncPending;
}

/** Gray mic chrome while awaiting any authoritative backend handshake. */
export function selectIsMicSyncPending(state: AssistantState): boolean {
  return selectIsServiceStateSyncPending(state) || selectIsCommandCaptureSyncPending(state);
}

export function selectIsAmbientEnabled(state: AssistantState): boolean {
  return state.serviceMode === 'ambient';
}

/** @deprecated Prefer selectIsAmbientEnabled — ambient on means background listening. */
export function selectIsServiceEnabled(state: AssistantState): boolean {
  return selectIsAmbientEnabled(state);
}

/** True when service mode is `command` (direct assistant session claimed). */
export function selectIsCommandService(state: AssistantState): boolean {
  return state.serviceMode === 'command';
}

export function selectIsCommandOwner(
  state: AssistantState,
  sessionId: string | null | undefined,
): boolean {
  return (
    state.serviceMode === 'command' &&
    !!sessionId &&
    state.commandOwnerSessionId === sessionId &&
    state.commandState !== 'locked'
  );
}

export function selectCanClaimCommandService(
  state: AssistantState,
  sessionId: string | null | undefined,
): boolean {
  if (selectIsCommandOwner(state, sessionId)) return true;
  if (state.serviceMode === 'ambient') return true;
  if (state.isConnected && state.serviceMode === 'off') return true;
  return false;
}

export function selectCommandMode(state: AssistantState): CommandMode {
  return state.commandMode;
}

export function selectIntroductionActive(state: AssistantState): boolean {
  return state.serviceMode === 'command' && state.commandMode === 'introduction';
}

export function selectRetrainingActive(state: AssistantState): boolean {
  return state.serviceMode === 'command' && state.commandMode === 'retraining';
}

/** Introduction or retraining — conversational voice enrollment sessions. */
export function selectVoiceEnrollmentActive(state: AssistantState): boolean {
  return (
    state.serviceMode === 'command' &&
    (state.commandMode === 'introduction' || state.commandMode === 'retraining')
  );
}

export function selectShouldRunAudioPipeline(
  state: AssistantState,
  sessionId: string | null,
): boolean {
  if (!state.isConnected || state.registrationConflict) return false;
  if (state.serviceMode === 'ambient') return true;
  return selectIsCommandOwner(state, sessionId);
}

export function selectShouldStreamAudio(state: AssistantState): boolean {
  return state.commandState !== 'locked';
}

const CAPTURE_STATES: ReadonlySet<CommandState> = new Set(['listening', 'follow_up']);
const BUSY_STATES: ReadonlySet<CommandState> = new Set(['thinking', 'responding']);

export function selectShouldForwardAudioChunks(state: AssistantState): boolean {
  if (state.serviceMode === 'ambient' && state.commandState === 'idle') return true;
  return CAPTURE_STATES.has(state.commandState);
}

export function selectIsAssistantBusy(state: AssistantState): boolean {
  return BUSY_STATES.has(state.commandState);
}

export const COMMAND_THINKING_STATES: ReadonlySet<CommandState> = new Set([
  'thinking',
  'responding',
]);

/** True while inference, streaming, or typewriter readout is in progress (not follow-up capture). */
export function selectIsCommandThinking(
  state: AssistantState,
  assistantBubbleStatus?: AssistantBubbleStatus | null,
): boolean {
  if (state.commandThinkingActive) return true;
  if (COMMAND_THINKING_STATES.has(state.commandState)) return true;
  if (
    assistantBubbleStatus === 'streaming' ||
    assistantBubbleStatus === 'revealing'
  ) {
    return true;
  }
  return false;
}

export const COMMAND_CAPTURE_STATES: ReadonlySet<CommandState> = new Set(['listening', 'follow_up']);
