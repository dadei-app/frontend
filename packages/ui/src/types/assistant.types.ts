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
  /** Monotonic revision from backend `assistant_state` snapshots. */
  serviceStateRevision: number;
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
  serviceStateRevision: 0,
};

export type AssistantAction =
  | { type: 'network/connected' }
  | { type: 'network/disconnected' }
  | { type: 'network/registration_conflict' }
  | { type: 'service/toggling'; toggling: boolean }
  | {
      type: 'assistant_state/sync';
      revision: number;
      serviceMode: ServiceMode;
      commandOwnerSessionId: string | null;
      commandServiceExpiresAt: string | null;
      commandState: CommandState;
      commandMode: CommandMode;
    }
  | { type: 'command/state'; commandState: CommandState }
  | { type: 'command/mode'; commandMode: CommandMode }
  | { type: 'runtime/reset' };
