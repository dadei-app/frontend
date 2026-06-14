/**
 * Idle time after the assistant finishes before ending the session.
 * The user must START speaking within this window; once they do, the timer is cleared
 * until the next response completes.
 */
export const FOLLOW_UP_MIN_MS = 7_000;
export const FOLLOW_UP_MAX_MS = 15_000;
export const FOLLOW_UP_PER_CHAR_MS = 50;

/** Follow-up idle window: 7–15s from assistant response length (`min(MAX, MIN + chars × PER_CHAR_MS)`). */
export function computeFollowUpMs(responseChars: number): number {
  const raw = FOLLOW_UP_MIN_MS + responseChars * FOLLOW_UP_PER_CHAR_MS;
  return Math.min(FOLLOW_UP_MAX_MS, Math.max(FOLLOW_UP_MIN_MS, raw));
}

/** Hold duration for assistant claim (must cover follow-up window + capture). */
export const CLAIM_HOLD_SECONDS = 45;
export const CLAIM_RENEW_BEFORE_EXPIRE_MS = 8_000;

/** Command bubble motion easing. */
export const VOICE_EASE = [0.22, 1, 0.36, 1] as const;

/** User + assistant pair slides up into the stack on entry. */
export const COMMAND_TURN_PAIR_SLIDE_PX = 32;
export const COMMAND_TURN_PAIR_ENTRY_MS = 0.4;
export const COMMAND_TURN_PAIR_LAYOUT_MS = 0.38;

/**
 * Client-side command capture (listening / follow-up). Separate from wake-word threshold.
 * Lower RMS = quieter speech counts as active (aura + end-of-utterance timing).
 */
export const COMMAND_SPEECH_RMS = 0.12;
/** Minimum sustained voicing before end-of-utterance can fire (filters coughs/clicks). */
export const COMMAND_MIN_SPEECH_MS = 600;
/** Sustained silence after speech before ending capture (command + introduction). */
export const COMMAND_UTTERANCE_END_SILENCE_MS = 2_500;
/** Analyser level multiplier while capturing a command (mic aura only). */
export const COMMAND_MIC_LEVEL_GAIN = 2.45;

/** Follow-up idle timer reset when user speaks again (follow_up state only). */
export const FOLLOW_UP_SPEECH_RMS = 0.12;
