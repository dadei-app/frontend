import { describe, expect, it } from 'vitest';
import {
  COMMAND_MODES,
  ENROLLMENT_KICKOFF_TEXT,
  ENROLLMENT_TRANSCRIPT_OPENER,
  isEnrollmentMode,
} from '@dadei/ui/types/command.types';

describe('command.types', () => {
  it('lists all command modes accepted by POST /service/command/text', () => {
    expect(COMMAND_MODES).toEqual(['normal', 'introduction', 'retraining']);
  });
  it('identifies enrollment modes', () => {
    expect(isEnrollmentMode('introduction')).toBe(true);
    expect(isEnrollmentMode('retraining')).toBe(true);
    expect(isEnrollmentMode('normal')).toBe(false);
  });

  it('uses one kickoff token for all enrollment sessions', () => {
    expect(ENROLLMENT_KICKOFF_TEXT).toBe('__dadei_enrollment_kickoff__');
  });

  it('uses the same transcript opener for introduction and retraining', () => {
    expect(ENROLLMENT_TRANSCRIPT_OPENER).toMatch(/spell your name/i);
  });
});
