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
    expect(normalizeAssistantStatusBase('Checking my calendar...')).toBe('Checking my calendar');
  });

  it('uses first-person phrase labels for known tools', () => {
    expect(commandToolLabel('calendar_list_events')).toBe('Checking my calendar');
    expect(commandToolLabel('gmail_list')).toBe('Scanning the inbox');
    expect(commandToolLabel('drive_list_files')).toBe('Sorting through my drive');
    expect(commandToolLabel('load_tool_groups')).toBe('Preparing my tools');
  });

  it('uses prefix fallbacks for unmapped tools in a family', () => {
    expect(commandToolLabel('gmail_future_action')).toBe('Checking my email');
  });

  it('title-cases unknown tools from snake_case', () => {
    expect(commandToolLabel('custom_demo_tool')).toBe('Custom Demo Tool');
  });

  it('formats status lines in title case', () => {
    expect(formatAssistantStatusLine('thinking')).toBe('Thinking');
    expect(commandToolStatusLabel('get_weather')).toBe('Checking the weather');
    expect(formatAssistantStatusLine('scanning my inbox')).toBe('Scanning My Inbox');
  });
});
