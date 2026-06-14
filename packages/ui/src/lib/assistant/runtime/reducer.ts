import type { CommandState } from '@dadei/ui/types/voice.types';
import {
  INITIAL_ASSISTANT_RUNTIME,
  type AssistantRuntimeAction,
  type AssistantRuntimeState,
  type CommandPhase,
  type ServicePhase,
} from './types';

export function assistantRuntimeReducer(
  state: AssistantRuntimeState,
  action: AssistantRuntimeAction,
): AssistantRuntimeState {
  switch (action.type) {
    case 'network/connected':
      return { ...state, isConnected: true, registrationConflict: false };

    case 'network/disconnected':
      return {
        ...INITIAL_ASSISTANT_RUNTIME,
        registrationConflict: state.registrationConflict,
      };

    case 'network/registration_conflict':
      return {
        ...INITIAL_ASSISTANT_RUNTIME,
        registrationConflict: true,
      };

    case 'service/toggling':
      return { ...state, isTogglingService: action.toggling };

    case 'service/status': {
      if (action.enabled) {
        if (state.service === 'command') return state;
        return {
          ...state,
          service: 'ambient',
          command: 'idle',
          submode: 'normal',
        };
      }
      if (state.service === 'command') return state;
      return {
        ...state,
        service: 'off',
        command: 'idle',
        submode: 'normal',
        commandOwnerSessionId: null,
        commandModeExpiresAt: null,
      };
    }

    case 'command/sync': {
      if (action.active) {
        return {
          ...state,
          service: 'command',
          commandOwnerSessionId: action.ownerSessionId,
          commandModeExpiresAt: action.expiresAt,
          command:
            state.service === 'command' && state.command !== 'idle'
              ? state.command
              : state.command === 'locked'
                ? 'locked'
                : 'idle',
        };
      }
      const nextService: ServicePhase = state.service === 'command' ? 'ambient' : state.service;
      return {
        ...state,
        service: nextService,
        command: 'idle',
        submode: 'normal',
        commandOwnerSessionId: null,
        commandModeExpiresAt: null,
      };
    }

    case 'command/phase': {
      if (state.service !== 'command' && action.phase !== 'idle' && action.phase !== 'locked') {
        return state;
      }
      if (action.phase === 'idle' || action.phase === 'locked') {
        return { ...state, command: action.phase, submode: action.phase === 'idle' ? 'normal' : state.submode };
      }
      return { ...state, service: 'command', command: action.phase };
    }

    case 'command/submode':
      return { ...state, submode: action.submode };

    case 'runtime/reset':
      return { ...INITIAL_ASSISTANT_RUNTIME };

    default:
      return state;
  }
}

export function selectIsAmbientEnabled(state: AssistantRuntimeState): boolean {
  return state.service === 'ambient';
}

/** @deprecated Prefer selectIsAmbientEnabled — "service enabled" means ambient listening. */
export function selectIsServiceEnabled(state: AssistantRuntimeState): boolean {
  return selectIsAmbientEnabled(state);
}

export function selectIsCommandMode(state: AssistantRuntimeState): boolean {
  return state.service === 'command';
}

export function selectIsCommandOwner(
  state: AssistantRuntimeState,
  sessionId: string | null | undefined,
): boolean {
  return (
    state.service === 'command' &&
    !!sessionId &&
    state.commandOwnerSessionId === sessionId &&
    state.command !== 'locked'
  );
}

export function selectCanClaimCommandMode(
  state: AssistantRuntimeState,
  sessionId: string | null | undefined,
): boolean {
  if (selectIsCommandOwner(state, sessionId)) return true;
  if (state.service === 'ambient') return true;
  // Introduction/retraining claim command mode while ambient is off but realtime is connected.
  if (state.isConnected && state.service === 'off') return true;
  return false;
}

/** Active command stream mode for POST /service/command/text (same as runtime submode). */
export function selectCommandStreamMode(state: AssistantRuntimeState): CommandSubmode {
  return state.submode;
}

export function selectIntroductionActive(state: AssistantRuntimeState): boolean {
  return state.service === 'command' && state.submode === 'introduction';
}

export function selectRetrainingActive(state: AssistantRuntimeState): boolean {
  return state.service === 'command' && state.submode === 'retraining';
}

/** Introduction or retraining — conversational voice enrollment sessions. */
export function selectVoiceEnrollmentActive(state: AssistantRuntimeState): boolean {
  return (
    state.service === 'command' &&
    (state.submode === 'introduction' || state.submode === 'retraining')
  );
}

export function selectShouldRunAudioPipeline(state: AssistantRuntimeState, sessionId: string | null): boolean {
  if (!state.isConnected || state.registrationConflict) return false;
  if (state.service === 'ambient') return true;
  return selectIsCommandOwner(state, sessionId);
}

export function selectShouldStreamAudio(state: AssistantRuntimeState): boolean {
  return state.command !== 'locked';
}

const CAPTURE_PHASES: ReadonlySet<CommandPhase> = new Set(['listening', 'follow_up']);
const BUSY_PHASES: ReadonlySet<CommandPhase> = new Set(['transcribing', 'thinking', 'responding']);

export function selectShouldForwardAudioChunks(state: AssistantRuntimeState): boolean {
  if (state.service === 'ambient' && state.command === 'idle') return true;
  return CAPTURE_PHASES.has(state.command);
}

export function selectIsAssistantBusy(state: AssistantRuntimeState): boolean {
  return BUSY_PHASES.has(state.command);
}

/** Map legacy CommandState to runtime command phase (for bridge during migration). */
export function commandStateToPhase(state: CommandState): CommandPhase {
  return state;
}

export function phaseToCommandState(phase: CommandPhase): CommandState {
  return phase;
}

export const COMMAND_PROCESSING_PHASES: ReadonlySet<CommandPhase> = new Set([
  'transcribing',
  'thinking',
  'responding',
]);

export const COMMAND_CAPTURE_PHASES: ReadonlySet<CommandPhase> = new Set(['listening', 'follow_up']);
