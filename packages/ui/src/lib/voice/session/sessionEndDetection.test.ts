import { describe, expect, it } from 'vitest';
import { isSessionEndUtterance } from './sessionEndDetection';

describe('isSessionEndUtterance', () => {
  it('matches common dismiss phrases', () => {
    expect(isSessionEndUtterance('thanks')).toBe(true);
    expect(isSessionEndUtterance('Thank you!')).toBe(true);
    expect(isSessionEndUtterance('cool')).toBe(true);
    expect(isSessionEndUtterance('bye')).toBe(true);
    expect(isSessionEndUtterance("that's all")).toBe(true);
    expect(isSessionEndUtterance('ok thanks')).toBe(true);
  });

  it('does not match substantive follow-ups', () => {
    expect(isSessionEndUtterance('thanks, what about tomorrow')).toBe(false);
    expect(isSessionEndUtterance('cool, add a reminder')).toBe(false);
    expect(isSessionEndUtterance('what is on my calendar')).toBe(false);
  });
});
