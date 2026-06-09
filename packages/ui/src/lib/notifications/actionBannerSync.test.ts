import { describe, expect, it } from 'vitest';
import { normalizeNotificationActions } from './actionBannerSync';
import type { NetworkAction } from '@dadei/ui/types/models.types';

function action(partial: Partial<NetworkAction> & { id: string }): NetworkAction {
  return {
    network_id: 'net-1',
    action_type: 'calendar',
    status: 'proposed',
    title: 'Test',
    scheduled_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    start_time: null,
    end_time: null,
    conversation_id: null,
    interaction_id: null,
    ...partial,
  };
}

describe('normalizeNotificationActions', () => {
  it('dedupes by id and keeps order', () => {
    const a = action({ id: 'a', is_active: true, scheduled_at: '2026-01-01T00:00:10Z' });
    const b = action({ id: 'b' });
    const result = normalizeNotificationActions([a, a, b]);
    expect(result.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('drops non-notification and non-proposed', () => {
    const result = normalizeNotificationActions([
      action({ id: 'a', action_type: 'drive_file' }),
      action({ id: 'b', status: 'confirmed' }),
    ]);
    expect(result).toHaveLength(0);
  });
});
