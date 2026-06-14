import { describe, expect, it } from 'vitest';

import { commandToolStatusLabel } from '@dadei/ui/lib/assistant/voice/labels/commandToolLabels';
import { formatCommandToolStatusHint } from '@dadei/ui/lib/assistant/voice/labels/commandToolStatusHints';

const TZ = 'America/New_York';

describe('formatCommandToolStatusHint', () => {
  it('describes load_tool_groups with friendly group names', () => {
    expect(
      formatCommandToolStatusHint('load_tool_groups', { groups: ['calendar', 'email'] }, TZ),
    ).toBe('Loading calendar and email tools');
  });

  it('describes calendar_list with a text filter', () => {
    expect(
      formatCommandToolStatusHint('calendar_list', { q: 'standup' }, TZ),
    ).toBe('Searching calendar for "standup"');
  });

  it('describes calendar_list across a fixed date range', () => {
    expect(
      formatCommandToolStatusHint(
        'calendar_list',
        {
          time_min_iso: '2027-01-10T05:00:00Z',
          time_max_iso: '2027-01-13T04:59:59Z',
        },
        TZ,
      ),
    ).toBe('Checking calendar for Sunday, Jan 10–Tuesday, Jan 12');
  });

  it('describes gmail_search with a truncated query', () => {
    const longQuery = 'professor office hours spring semester final exam schedule';
    const hint = formatCommandToolStatusHint('gmail_search', { query: longQuery }, TZ);
    expect(hint).toMatch(/^Searching inbox for "/);
    expect(hint!.length).toBeLessThan(longQuery.length + 24);
  });

  it('describes get_client_context keys', () => {
    expect(
      formatCommandToolStatusHint('get_client_context', { keys: ['location'] }, TZ),
    ).toBe('Getting your location');
  });

  it('falls back when args are missing', () => {
    expect(formatCommandToolStatusHint('calendar_list', undefined, TZ)).toBeNull();
  });
});

describe('commandToolStatusLabel', () => {
  it('uses arg-aware hints when available', () => {
    expect(
      commandToolStatusLabel('search_memory', { query: 'brother' }, { timeZone: TZ }),
    ).toBe('Searching memory for "brother"');
  });

  it('falls back to static labels without args', () => {
    expect(commandToolStatusLabel('calendar_list')).toBe('Checking the calendar');
  });
});
