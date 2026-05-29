export const FOLLOW_UP_MIN_MS = 3_000;
export const FOLLOW_UP_MAX_MS = 10_000;
export const FOLLOW_UP_PER_CHAR_MS = 50;

/** Dynamic follow-up window. `min(MAX, MIN + chars × PER_CHAR_MS)`. */
export function computeFollowUpMs(responseChars: number): number {
  const raw = FOLLOW_UP_MIN_MS + responseChars * FOLLOW_UP_PER_CHAR_MS;
  return Math.min(raw, FOLLOW_UP_MAX_MS);
}

/** Hold duration for the claim. Short — falls back to release on expiry. */
export const CLAIM_HOLD_SECONDS = 5;
export const CLAIM_RENEW_BEFORE_EXPIRE_MS = 1_500;

/** Command bubble motion easing. */
export const VOICE_EASE = [0.22, 1, 0.36, 1] as const;
