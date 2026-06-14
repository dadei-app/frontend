import type { CommandMode, CommandState } from '@dadei/ui/types/command.types';
import type { ServiceMode } from '@dadei/ui/types/service.types';

/**
 * Composed assistant store — derived on the client from service webhooks,
 * command-mode claim responses, and local command UI state.
 *
 * Not a backend DTO; see `service.types` and `command.types` for wire shapes.
 */
export interface AssistantState {
  serviceMode: ServiceMode;
  commandState: CommandState;
  commandMode: CommandMode;
  commandOwnerSessionId: string | null;
  commandServiceExpiresAt: string | null;
  isConnected: boolean;
  registrationConflict: boolean;
  isTogglingService: boolean;
}

export const INITIAL_ASSISTANT_STATE: AssistantState = {
  serviceMode: 'off',
  commandState: 'idle',
  commandMode: 'normal',
  commandOwnerSessionId: null,
  commandServiceExpiresAt: null,
  isConnected: false,
  registrationConflict: false,
  isTogglingService: false,
};

export type AssistantAction =
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
  | { type: 'command/state'; commandState: CommandState }
  | { type: 'command/mode'; commandMode: CommandMode }
  | { type: 'runtime/reset' };
