import { describe, expect, it } from 'vitest';
import {
  commandToolLabel,
  commandToolStatusLabel,
  formatAssistantStatusLine,
  normalizeAssistantStatusBase,
} from './commandToolLabels';

describe('commandToolLabels', () => {
  it('normalizes trailing ellipses', () => {
    expect(normalizeAssistantStatusBase('Thinking…')).toBe('Thinking');
    expect(normalizeAssistantStatusBase('Checking Your Calendar...')).toBe('Checking Your Calendar');
  });

  it('uses title case for known tools', () => {
    expect(commandToolLabel('list_calendar_events')).toBe('Checking Your Calendar');
    expect(commandToolLabel('load_tool_groups')).toBe('Summoning Specialist Tools');
  });

  it('title-cases unknown tools from snake_case', () => {
    expect(commandToolLabel('custom_demo_tool')).toBe('Custom Demo Tool');
  });

  it('formats status lines in title case', () => {
    expect(formatAssistantStatusLine('thinking')).toBe('Thinking');
    expect(commandToolStatusLabel('get_weather')).toBe('Checking The Weather');
  });
});
