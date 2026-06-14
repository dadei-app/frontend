import { describe, expect, it } from 'vitest';
import { micLevelAuraMotion } from '@dadei/ui/contexts/AudioContext';

describe('micLevelAuraMotion', () => {
  it('uses 75%-strength motion targets at full mic level', () => {
    const quiet = micLevelAuraMotion(0, true);
    const loud = micLevelAuraMotion(1, true);
    const hidden = micLevelAuraMotion(1, false);

    expect(quiet.scale).toBeCloseTo(1.06, 5);
    expect(quiet.opacity).toBeCloseTo(0.33, 5);
    expect(loud.scale).toBeCloseTo(1.75, 5);
    expect(loud.opacity).toBeCloseTo(0.75, 5);
    expect(loud.y).toBeCloseTo(-19.5, 5);
    expect(hidden.opacity).toBe(0);
  });
});
