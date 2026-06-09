import { describe, expect, it } from 'vitest';
import {
  formatCommandStreamError,
  formatWsTranscriptError,
  getUserErrorMessage,
  parseApiDetail,
  sanitizeTechnicalMessage,
} from './userMessage';

describe('userMessage', () => {
  it('maps quota errors', () => {
    expect(sanitizeTechnicalMessage('429 RESOURCE_EXHAUSTED depleted')).toMatch(/quota|billing/i);
  });

  it('parses structured API detail', () => {
    const { code, message } = parseApiDetail({
      code: 'command_mode_not_owner',
      message: 'This session does not own assistant mode',
    });
    expect(code).toBe('command_mode_not_owner');
    expect(message).toMatch(/another device/i);
  });

  it('formats command stream by code', () => {
    expect(formatCommandStreamError('raw', 'rate_limited')).toMatch(/quota|billing/i);
  });

  it('formats websocket transcript errors', () => {
    expect(
      formatWsTranscriptError({ code: 'command_mode_not_owner', message: 'x' }),
    ).toMatch(/another device/i);
  });

  it('getUserErrorMessage handles plain Error', () => {
    expect(getUserErrorMessage(new Error('timeout'))).toMatch(/too long|try again/i);
  });
});
