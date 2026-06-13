/** Rush when the stream finished far ahead of playback. */
const CATCH_UP_BACKLOG = 36;

const RUSH_MS_MIN = 6;
const RUSH_MS_MAX = 14;

/** Typical human inter-key intervals are ~50–120ms; we bias slower for readability. */
const CHAR_MS_MIN = 18;
const CHAR_MS_MAX = 52;

const SPACE_MS_MIN = 32;
const SPACE_MS_MAX = 72;

const PUNCTUATION_STRONG_MS_MIN = 95;
const PUNCTUATION_STRONG_MS_MAX = 165;

const PUNCTUATION_LIGHT_MS_MIN = 48;
const PUNCTUATION_LIGHT_MS_MAX = 88;

const NEWLINE_MS_MIN = 140;
const NEWLINE_MS_MAX = 220;

const HESITATION_CHANCE = 0.028;
const HESITATION_MS_MIN = 90;
const HESITATION_MS_MAX = 200;

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Delay before revealing the next character. Spaces and sentence punctuation
 * get longer pauses so word and phrase boundaries read naturally.
 */
export function typewriterDelayBeforeChar(char: string, backlogRemaining: number): number {
  if (backlogRemaining > CATCH_UP_BACKLOG) {
    return randBetween(RUSH_MS_MIN, RUSH_MS_MAX);
  }

  if (char === '\n') {
    return randBetween(NEWLINE_MS_MIN, NEWLINE_MS_MAX);
  }

  if (/[.!?]/.test(char)) {
    return randBetween(PUNCTUATION_STRONG_MS_MIN, PUNCTUATION_STRONG_MS_MAX);
  }

  if (/[,;:]/.test(char)) {
    return randBetween(PUNCTUATION_LIGHT_MS_MIN, PUNCTUATION_LIGHT_MS_MAX);
  }

  if (char === ' ') {
    return randBetween(SPACE_MS_MIN, SPACE_MS_MAX);
  }

  let delay = randBetween(CHAR_MS_MIN, CHAR_MS_MAX);

  if (Math.random() < HESITATION_CHANCE) {
    delay += randBetween(HESITATION_MS_MIN, HESITATION_MS_MAX);
  }

  return delay;
}

/** How many characters to reveal in one tick when catching up. */
export function typewriterRevealStep(backlogRemaining: number): number {
  if (backlogRemaining > 64) return 4;
  if (backlogRemaining > 32) return 2;
  return 1;
}
