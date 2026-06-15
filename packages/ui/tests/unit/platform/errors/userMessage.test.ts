import { describe, expect, it } from 'vitest';
import {
  formatCommandStreamError,
  formatWsTranscriptError,
  getUserErrorMessage,
  parseApiDetail,
  sanitizeTechnicalMessage,
} from '@dadei/ui/lib/platform/errors/userMessage';

describe('userMessage', () => {
  it('emits a user-facing message for quota errors', () => {
    const message = sanitizeTechnicalMessage('429 RESOURCE_EXHAUSTED depleted');
    expect(message).toBeTruthy();
    expect(message).not.toMatch(/429|resource_exhausted/i);
  });

  it('parses structured API detail', () => {
    const { code, message } = parseApiDetail({
      code: 'command_mode_not_owner',
      message: 'This session does not own assistant mode',
    });
    expect(code).toBe('command_mode_not_owner');
    expect(message).toBeTruthy();
  });

  it('emits a user-facing command stream error for known codes', () => {
    const message = formatCommandStreamError('raw', 'rate_limited');
    expect(message).toBeTruthy();
    expect(message).not.toBe('raw');
  });

  it('emits a websocket transcript error message', () => {
    const message = formatWsTranscriptError({
      code: 'command_mode_not_owner',
      message: 'x',
    });
    expect(message).toBeTruthy();
  });

  it('emits a user-facing message for plain Error values', () => {
    const message = getUserErrorMessage(new Error('timeout'));
    expect(message).toBeTruthy();
    expect(message).not.toMatch(/timeout/i);
  });
});
