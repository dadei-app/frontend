import { describe, expect, it } from 'vitest';
import {
  actionDomainLabel,
  actionOperationLabel,
  isNotificationAction,
  operationForToolName,
  resolveActionOperation,
} from './actionDisplay';
import type { NetworkAction } from '@dadei/ui/types/models.types';

function action(overrides: Partial<NetworkAction>): NetworkAction {
  return {
    id: '1',
    network_id: '2',
    action_type: 'calendar_event',
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
  it('detects calendar_delete_event as delete', () => {
    expect(operationForToolName('calendar_delete_event')).toBe('delete');
  });

  it('detects legacy delete_calendar_event as delete', () => {
    expect(operationForToolName('delete_calendar_event')).toBe('delete');
  });
});

describe('resolveActionOperation', () => {
  it('prefers explicit operation', () => {
    expect(
      resolveActionOperation({
        operation: 'update',
        tool_name: 'calendar_delete_event',
      }),
    ).toBe('update');
  });

  it('derives from tool_name when operation missing', () => {
    expect(
      resolveActionOperation({
        operation: null,
        tool_name: 'calendar_delete_event',
      }),
    ).toBe('delete');
  });
});

describe('isNotificationAction', () => {
  it('includes calendar, task, and email domains', () => {
    expect(isNotificationAction(action({ action_type: 'calendar_event' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'task' }))).toBe(true);
    expect(isNotificationAction(action({ action_type: 'email' }))).toBe(true);
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
    expect(actionDomainLabel('calendar_event')).toBe('Calendar');
    expect(actionDomainLabel('task')).toBe('Task');
    expect(actionDomainLabel('email')).toBe('Email');
  });
});
