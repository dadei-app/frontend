import { describe, expect, it } from 'vitest';
import { isProposedToolSummary, proposedActionHumanLine } from '@dadei/ui/lib/workspace/display/actionDisplay';

describe('proposed tool summaries', () => {
  it('detects nested proposed JSON in message (legacy SSE)', () => {
    const summary = JSON.stringify({
      message: JSON.stringify({
        proposed: true,
        kind: 'calendar',
        operation: 'create',
        title: 'Team sync',
      }),
    });
    expect(isProposedToolSummary(JSON.parse(summary))).toBe(true);
  });

  it('detects proposed flag on SSE wrapper', () => {
    expect(isProposedToolSummary({ proposed: true, speech: 'Scheduled Team sync.' })).toBe(true);
  });

  it('formats human lines without JSON', () => {
    const line = proposedActionHumanLine({
      proposed: true,
      kind: 'calendar',
      operation: 'create',
      title: 'Team sync',
    });
    expect(line).toBe('Scheduled Team sync.');
    expect(line).not.toContain('{');
  });
});
