/**
 * Service pipeline selection (client-derived from network flags).
 *
 * Backend stores `service_enabled` + `assistant_mode_active` separately; the UI
 * collapses them into one mode:
 *   - off     → ambient disabled, no command claim
 *   - ambient → service_enabled, no active command claim
 *   - command → assistant_mode_active (direct session claimed)
 *
 * Wire/API still uses legacy name `command_mode` for the claim lock — see
 * `ServiceModeClaim` (backend: `CommandModeStateResponse`, webhook `command_mode`).
 */

export type ServiceMode = 'off' | 'ambient' | 'command';

/** PATCH …/command-mode/* response and `command_mode` webhook payload fields. */
export interface ServiceModeClaim {
  active: boolean;
  owner_session_id: string | null;
  expires_at: string | null;
}
