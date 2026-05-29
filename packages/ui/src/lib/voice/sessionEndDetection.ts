/**
 * Detect when the user is dismissing the voice assistant (not asking a follow-up).
 * Only matches when the entire utterance is a closing phrase — "thanks, what about tomorrow" is not a dismiss.
 */

export function normalizeForSessionEnd(text: string): string {
  return text
    .trim()
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const SESSION_END_PATTERNS: RegExp[] = [
  /^thanks?$/,
  /^thank you$/,
  /^thanks? (so )?much$/,
  /^many thanks$/,
  /^cool$/,
  /^thanks? cool$/,
  /^cool thanks?$/,
  /^ok(?:ay)? thanks?$/,
  /^thanks? ok(?:ay)?$/,
  /^bye$/,
  /^goodbye$/,
  /^see you(?: later)?$/,
  /^talk to you later$/,
  /^that'?s (all|it|enough)$/,
  /^i'?m (done|good|all set)$/,
  /^we'?re (done|good|all set)$/,
  /^all set$/,
  /^stop listening$/,
  /^never mind$/,
  /^no thanks?$/,
  /^cheers$/,
  /^perfect thanks?$/,
  /^great thanks?$/,
  /^sounds good$/,
  /^thanks? bye$/,
  /^thanks? goodbye$/,
  /^you'?re welcome$/,
];

export function isSessionEndUtterance(text: string): boolean {
  const normalized = normalizeForSessionEnd(text);
  if (!normalized) return false;
  return SESSION_END_PATTERNS.some((pattern) => pattern.test(normalized));
}
