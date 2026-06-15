import { describe, expect, it } from 'vitest';
import {
  formatConfidence,
  isNotificationAction,
  operationForToolName,
  resolveActionOperation,
  resolveMemoryConfidence,
} from '@dadei/ui/lib/workspace/display/actionDisplay';
import type { NetworkAction } from '@dadei/ui/types/models.types';

function action(overrides: Partial<NetworkAction>): NetworkAction {
  return {
    id: '1',
    network_id: '2',
    action_type: 'calendar',
    status: 'proposed',
    title: 'Team sync',
    scheduled_at: '2026-06-03T12:00:10Z',
    created_at: '2026-06-03T12:00:00Z',
    updated_at: '2026-06-03T12:00:00Z',
    start_time: null,
    end_time: null,
    conversation_id: null,
    interaction_id: null,
    ...overrides,
  };
}

describe('operationForToolName', () => {
  it('detects calendar_delete as delete', () => {
    expect(operationForToolName('calendar_delete')).toBe('delete');
  });
});

describe('resolveActionOperation', () => {
  it('prefers explicit operation', () => {
    expect(
      resolveActionOperation({
        operation: 'update',
        tool_name: 'calendar_delete',
      }),
    ).toBe('update');
  });

  it('derives from tool_name when operation missing', () => {
    expect(
      resolveActionOperation({
        operation: null,
        tool_name: 'calendar_delete',
      }),
    ).toBe('delete');
  });
});

describe('isNotificationAction', () => {
  it('includes calendar, email, and workspace side-effect domains', () => {
    expect(isNotificationAction(action({ action_type: 'calendar' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'email' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'conversation' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'interaction' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'person' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'task' }))).toBe(false);
    expect(isNotificationAction(action({ action_type: 'contact' }))).toBe(false);
  });

  it('excludes non-notification domains', () => {
    expect(isNotificationAction(action({ action_type: 'drive_file' }))).toBe(false);
    expect(isNotificationAction(action({ action_type: 'command' }))).toBe(false);
  });
});

describe('resolveMemoryConfidence', () => {
  it('reads top-level confidence on 0–1 scale', () => {
    expect(resolveMemoryConfidence({ confidence: 0.82 })).toBe(0.82);
  });

  it('falls back to details.confidence', () => {
    expect(resolveMemoryConfidence({ confidence: null, details: { confidence: 0.55 } })).toBe(0.55);
  });

  it('normalizes percent-scale values', () => {
    expect(resolveMemoryConfidence({ confidence: 65 })).toBe(0.65);
    expect(formatConfidence(0.9)).toContain('90');
    expect(formatConfidence(65)).toContain('65');
  });
});
