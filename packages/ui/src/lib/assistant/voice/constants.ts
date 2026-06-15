/**
 * Idle time after the assistant finishes before ending the session.
 * The user must START speaking within this window; once they do, the timer is cleared
 * until the next response completes.
 */
export const FOLLOW_UP_MIN_MS = 7_000;
/** ~19ms/char → ~10s at 160 chars; no upper cap so long replies get proportionally more time. */
export const FOLLOW_UP_PER_CHAR_MS = 19;

/** Follow-up idle window: `max(MIN, MIN + chars × PER_CHAR_MS)`. */
export function computeFollowUpMs(responseChars: number): number {
  const raw = FOLLOW_UP_MIN_MS + responseChars * FOLLOW_UP_PER_CHAR_MS;
  return Math.max(FOLLOW_UP_MIN_MS, raw);
}

/** Hold duration for assistant claim (must cover follow-up window + capture). */
export const CLAIM_HOLD_SECONDS = 45;
export const CLAIM_RENEW_BEFORE_EXPIRE_MS = 8_000;

/** Command bubble motion easing. */
export const VOICE_EASE = [0.22, 1, 0.36, 1] as const;

/** User + assistant pair slides up into the stack on entry. */
export const COMMAND_TURN_PAIR_SLIDE_PX = 32;
export const COMMAND_TURN_PAIR_ENTRY_MS = 0.58;
export const COMMAND_TURN_PAIR_LAYOUT_MS = 0.62;

/**
 * Mic level gain while capturing a command (listening / follow-up).
 * End-of-utterance timing is server-side (same segmentation as ambient pipeline).
 */
export const COMMAND_MIC_LEVEL_GAIN = 2.45;

/** Follow-up idle timer reset when user speaks again (follow_up state only). */
export const FOLLOW_UP_SPEECH_RMS = 0.12;
