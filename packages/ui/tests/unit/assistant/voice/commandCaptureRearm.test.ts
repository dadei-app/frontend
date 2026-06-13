import { describe, expect, it } from 'vitest';

/**
 * Mirrors the capture re-arm generation rules used after cancelProcessing.
 */
function canCommitUtteranceEnd(
  captureRearmGeneration: number,
  captureSpeechGeneration: number,
): boolean {
  return captureSpeechGeneration === captureRearmGeneration;
}

describe('command capture re-arm', () => {
  it('blocks utterance end after cancel until fresh speech is detected', () => {
    let rearmGeneration = 0;
    let speechGeneration = -1;

    expect(canCommitUtteranceEnd(rearmGeneration, speechGeneration)).toBe(false);

    speechGeneration = 0;
    expect(canCommitUtteranceEnd(rearmGeneration, speechGeneration)).toBe(true);

    rearmGeneration += 1;
    speechGeneration = -1;
    expect(canCommitUtteranceEnd(rearmGeneration, speechGeneration)).toBe(false);

    speechGeneration = rearmGeneration;
    expect(canCommitUtteranceEnd(rearmGeneration, speechGeneration)).toBe(true);
  });
});
