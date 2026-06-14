/**
 * Command stream modes — mirrors backend `mode` on POST /service/command/text.
 * Runtime `submode` uses the same values.
 */

export type CommandMode = 'normal' | 'introduction' | 'retraining';

export type EnrollmentMode = Extract<CommandMode, 'introduction' | 'retraining'>;

export const ENROLLMENT_MODES: ReadonlySet<EnrollmentMode> = new Set([
  'introduction',
  'retraining',
]);

/** Sent as `text` with `mode=introduction|retraining` to start an enrollment session. */
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
