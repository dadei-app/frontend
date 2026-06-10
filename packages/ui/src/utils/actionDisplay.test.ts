import { describe, expect, it } from 'vitest';
import {
  actionDomainLabel,
  actionOperationLabel,
  formatConfidence,
  isNotificationAction,
  operationForToolName,
  resolveActionOperation,
  resolveMemoryConfidence,
} from './actionDisplay';
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
  it('includes calendar and email domains only', () => {
    expect(isNotificationAction(action({ action_type: 'calendar' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'email' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'task' }))).toBe(false);
    expect(isNotificationAction(action({ action_type: 'contact' }))).toBe(false);
  });

  it('excludes non-notification domains', () => {
    expect(isNotificationAction(action({ action_type: 'drive_file' }))).toBe(false);
    expect(isNotificationAction(action({ action_type: 'command' }))).toBe(false);
  });
});

describe('actionOperationLabel', () => {
  it('maps create, update, and delete', () => {
    expect(actionOperationLabel('create')).toBe('Create');
    expect(actionOperationLabel('update')).toBe('Update');
    expect(actionOperationLabel('delete')).toBe('Delete');
  });
});

describe('actionDomainLabel', () => {
  it('humanizes known action types', () => {
    expect(actionDomainLabel('calendar')).toBe('Calendar');
    expect(actionDomainLabel('email')).toBe('Email');
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
    expect(formatConfidence(0.9)).toBe('90% confidence');
    expect(formatConfidence(65)).toBe('65% confidence');
  });
});
