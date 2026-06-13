import { describe, expect, it } from 'vitest';
import {
  formatToolResultUserMessage,
  sanitizeTechnicalMessage,
} from '@dadei/ui/lib/platform/errors/userMessage';

describe('sanitizeTechnicalMessage', () => {
  it('maps explicit overload errors', () => {
    expect(sanitizeTechnicalMessage('503 Service Unavailable')).toMatch(/overloaded/i);
    expect(sanitizeTechnicalMessage('The model is temporarily overloaded')).toMatch(/overloaded/i);
  });

  it('does not map tool location-unavailable copy to overloaded', () => {
    const message = 'Live client location unavailable. Ask the user for a location.';
    expect(sanitizeTechnicalMessage(message)).toBe(message);
    expect(formatToolResultUserMessage(JSON.stringify({ error: message }), false)).toBe(message);
  });
});
