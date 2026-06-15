import { describe, expect, it } from 'vitest';
import {
  formatToolResultUserMessage,
  sanitizeTechnicalMessage,
} from '@dadei/ui/lib/platform/errors/userMessage';

describe('sanitizeTechnicalMessage', () => {
  it('emits a user-facing message for overload errors', () => {
    const rawUnavailable = '503 Service Unavailable';
    const rawOverloaded = 'The model is temporarily overloaded';
    const unavailable = sanitizeTechnicalMessage(rawUnavailable);
    const overloaded = sanitizeTechnicalMessage(rawOverloaded);
    expect(unavailable).toBeTruthy();
    expect(overloaded).toBeTruthy();
    expect(unavailable).not.toBe(rawUnavailable);
    expect(overloaded).not.toBe(rawOverloaded);
    expect(unavailable).not.toMatch(/\b503\b/i);
  });

  it('emits tool location errors without remapping them to overload copy', () => {
    const message = 'Live client location unavailable. Ask them directly which city or area to use.';
    const sanitized = sanitizeTechnicalMessage(message);
    const toolMessage = formatToolResultUserMessage(JSON.stringify({ error: message }), false);
    const overloadMapped = sanitizeTechnicalMessage('503 Service Unavailable');
    expect(sanitized).toBeTruthy();
    expect(toolMessage).toBeTruthy();
    expect(sanitized).not.toBe(overloadMapped);
    expect(toolMessage).not.toBe(overloadMapped);
  });
});
