import type { CommandMode, CommandState } from '@dadei/ui/types/command.types';
import type { ServiceMode } from '@dadei/ui/types/service.types';
import {
  INITIAL_ASSISTANT_STATE,
  type AssistantAction,
  type AssistantState,
} from '@dadei/ui/types/assistant.types';

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

    case 'service/toggling':
      return { ...state, isTogglingService: action.toggling };

    case 'service/status': {
      if (action.enabled) {
        if (state.serviceMode === 'command') return state;
        return {
          ...state,
          serviceMode: 'ambient',
          commandState: 'idle',
          commandMode: 'normal',
        };
      }
      if (state.serviceMode === 'command') return state;
      return {
        ...state,
        serviceMode: 'off',
        commandState: 'idle',
        commandMode: 'normal',
        commandOwnerSessionId: null,
        commandServiceExpiresAt: null,
      };
    }

    case 'command/sync': {
      if (action.active) {
        return {
          ...state,
          serviceMode: 'command',
          commandOwnerSessionId: action.ownerSessionId,
          commandServiceExpiresAt: action.expiresAt,
          commandState:
            state.serviceMode === 'command' && state.commandState !== 'idle'
              ? state.commandState
              : state.commandState === 'locked'
                ? 'locked'
                : 'idle',
        };
      }
      const nextServiceMode: ServiceMode =
        state.serviceMode === 'command' ? 'ambient' : state.serviceMode;
      return {
        ...state,
        serviceMode: nextServiceMode,
        commandState: 'idle',
        commandMode: 'normal',
        commandOwnerSessionId: null,
        commandServiceExpiresAt: null,
      };
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

    case 'runtime/reset':
      return { ...INITIAL_ASSISTANT_STATE };

    default:
      return state;
  }
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
const BUSY_STATES: ReadonlySet<CommandState> = new Set(['transcribing', 'thinking', 'responding']);

export function selectShouldForwardAudioChunks(state: AssistantState): boolean {
  if (state.serviceMode === 'ambient' && state.commandState === 'idle') return true;
  return CAPTURE_STATES.has(state.commandState);
}

export function selectIsAssistantBusy(state: AssistantState): boolean {
  return BUSY_STATES.has(state.commandState);
}

export const COMMAND_PROCESSING_STATES: ReadonlySet<CommandState> = new Set([
  'transcribing',
  'thinking',
  'responding',
]);

export const COMMAND_CAPTURE_STATES: ReadonlySet<CommandState> = new Set(['listening', 'follow_up']);
