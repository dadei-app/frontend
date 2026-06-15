import { describe, expect, it } from 'vitest';
import { COMMAND_MODES, isEnrollmentMode } from '@dadei/ui/types/command.types';

describe('command.types', () => {
  it('lists all command modes accepted by POST /service/command/text', () => {
    expect(COMMAND_MODES).toEqual(['normal', 'introduction', 'retraining']);
  });

  it('identifies enrollment modes', () => {
    expect(isEnrollmentMode('introduction')).toBe(true);
    expect(isEnrollmentMode('retraining')).toBe(true);
    expect(isEnrollmentMode('normal')).toBe(false);
  });
});
