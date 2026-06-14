/** Top-level service lock: off → nothing runs; ambient → background listen; command → assistant session. */
export type ServicePhase = 'off' | 'ambient' | 'command';

/** Command pipeline phase — only meaningful when service === 'command'. */
export type CommandPhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'responding'
  | 'follow_up'
  | 'locked';

import type { CommandMode } from '@dadei/ui/types/command.types';

/** @see CommandMode — runtime submode matches POST /service/command/text `mode`. */
export type CommandSubmode = CommandMode;

export interface AssistantRuntimeState {
  service: ServicePhase;
  command: CommandPhase;
  submode: CommandSubmode;
  commandOwnerSessionId: string | null;
  commandModeExpiresAt: string | null;
  isConnected: boolean;
  registrationConflict: boolean;
  isTogglingService: boolean;
}

export const INITIAL_ASSISTANT_RUNTIME: AssistantRuntimeState = {
  service: 'off',
  command: 'idle',
  submode: 'normal',
  commandOwnerSessionId: null,
  commandModeExpiresAt: null,
  isConnected: false,
  registrationConflict: false,
  isTogglingService: false,
};

export type AssistantRuntimeAction =
  | { type: 'network/connected' }
  | { type: 'network/disconnected' }
  | { type: 'network/registration_conflict' }
  | { type: 'service/toggling'; toggling: boolean }
  | { type: 'service/status'; enabled: boolean }
  | {
      type: 'command/sync';
      active: boolean;
      ownerSessionId: string | null;
      expiresAt: string | null;
    }
  | { type: 'command/phase'; phase: CommandPhase }
  | { type: 'command/submode'; submode: CommandSubmode }
  | { type: 'runtime/reset' };
