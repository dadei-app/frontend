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
