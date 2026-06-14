/**
 * Command stream mode — POST /service/command/text `mode` form field.
 * Backend: `lib.inference.command.enrollment.CommandMode`
 */
export type CommandMode = 'normal' | 'introduction' | 'retraining';

/** Values accepted by POST /service/command/text — keep in sync with backend CommandMode. */
export const COMMAND_MODES = ['normal', 'introduction', 'retraining'] as const satisfies readonly CommandMode[];

/**
 * Command turn pipeline phase (client-only UI/runtime).
 * Backend has no equivalent enum; capture routing uses separate `CaptureMode`
 * (`ambient` | `command` | `introduction`) in command_input_pipeline.py.
 */
export type CommandState =
  | 'idle'
  | 'listening'
  /** User finished speaking; mic spinner only until transcript arrives. */
  | 'transcribing'
  | 'thinking'
  | 'responding'
  | 'follow_up'
  | 'locked';

/** pending/status = tool labels; streaming = buffering tokens; revealing = typewriter after done. */
export type AssistantBubbleStatus = 'pending' | 'streaming' | 'revealing' | 'done';

export type EnrollmentMode = Extract<CommandMode, 'introduction' | 'retraining'>;

export const ENROLLMENT_MODES: ReadonlySet<EnrollmentMode> = new Set([
  'introduction',
  'retraining',
]);

/**
 * Sent as `text` with `mode=introduction|retraining` to start an enrollment session.
 * Backend: `ENROLLMENT_KICKOFF` in enrollment.py
 */
export const ENROLLMENT_KICKOFF_TEXT = '__dadei_enrollment_kickoff__';

/**
 * Shown in the command transcript when introduction or retraining begins.
 * Same copy for both enrollment modes.
 */
export const ENROLLMENT_TRANSCRIPT_OPENER =
  'Spell your name letter by letter so I get it right.';

export function isEnrollmentMode(mode: CommandMode): mode is EnrollmentMode {
  return ENROLLMENT_MODES.has(mode as EnrollmentMode);
}
