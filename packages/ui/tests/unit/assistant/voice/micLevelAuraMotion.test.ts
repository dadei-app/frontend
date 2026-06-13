import { describe, expect, it } from 'vitest';
import { micLevelAuraMotion } from '@dadei/ui/contexts/AudioContext';

describe('micLevelAuraMotion', () => {
  it('scales opacity and size with mic level when visible', () => {
    const quiet = micLevelAuraMotion(0, true);
    const loud = micLevelAuraMotion(1, true);
    const hidden = micLevelAuraMotion(1, false);

    expect(quiet.scale).toBe(1.08);
    expect(quiet.opacity).toBe(0.44);
    expect(loud.scale).toBeCloseTo(2, 5);
    expect(loud.opacity).toBe(1);
    expect(hidden.opacity).toBe(0);
  });
});
