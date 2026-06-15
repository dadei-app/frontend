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
  /**
   * Mic chrome loading — waiting for authoritative `assistant_state`
   * websocket after a service mutation (enable/disable/claim/release).
   */
  serviceStateSyncPending: boolean;
  /**
   * Mic chrome loading — waiting for backend `command_inference_cancelled`
   * after the user stops thinking (capture pipeline re-armed server-side).
   */
  commandCaptureSyncPending: boolean;
  /** Revision at the time `serviceStateSyncPending` was set; cleared when a newer revision applies. */
  serviceStateSyncBaselineRevision: number | null;
  /** Monotonic revision from backend `assistant_state` snapshots. */
  serviceStateRevision: number;
  /**
   * A /command/text inference is starting or in flight (claim, RAG, SSE).
   * Drives mic cancel-thinking chrome before `commandState` reaches `thinking`.
   */
  commandThinkingActive: boolean;
}

export const INITIAL_ASSISTANT_STATE: AssistantState = {
  serviceMode: 'off',
  commandState: 'idle',
  commandMode: 'normal',
  commandOwnerSessionId: null,
  commandServiceExpiresAt: null,
  isConnected: false,
  registrationConflict: false,
  serviceStateSyncPending: false,
  commandCaptureSyncPending: false,
  serviceStateSyncBaselineRevision: null,
  serviceStateRevision: 0,
  commandThinkingActive: false,
};

export type AssistantAction =
  | { type: 'network/connected' }
  | { type: 'network/disconnected' }
  | { type: 'network/registration_conflict' }
  | {
      type: 'service_state/sync_pending';
      pending: boolean;
      baselineRevision?: number;
    }
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
  | { type: 'command/capture_sync_pending'; pending: boolean }
  | { type: 'command/thinking_active'; active: boolean }
  | { type: 'runtime/reset' };
