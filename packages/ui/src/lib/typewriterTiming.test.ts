import { describe, expect, it } from 'vitest';
import { typewriterDelayBeforeChar, typewriterRevealStep } from './typewriterTiming';

describe('typewriterTiming', () => {
  it('uses longer delays for spaces than a baseline character', () => {
    const spaceDelays: number[] = [];
    const charDelays: number[] = [];
    for (let i = 0; i < 200; i++) {
      spaceDelays.push(typewriterDelayBeforeChar(' ', 10));
      charDelays.push(typewriterDelayBeforeChar('a', 10));
    }
    const spaceAvg = spaceDelays.reduce((a, b) => a + b, 0) / spaceDelays.length;
    const charAvg = charDelays.reduce((a, b) => a + b, 0) / charDelays.length;
    expect(spaceAvg).toBeGreaterThan(charAvg);
  });

  it('reveals one character at a time unless backlog is large', () => {
    expect(typewriterRevealStep(5)).toBe(1);
    expect(typewriterRevealStep(40)).toBeGreaterThan(1);
  });
});
