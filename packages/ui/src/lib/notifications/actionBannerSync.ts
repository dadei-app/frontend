import { AUTO_FIRE_DELAY_MS } from '@dadei/ui/lib/notifications/constants';
import type { BannerItem } from '@dadei/ui/contexts/NotificationContext';
import type { NetworkAction } from '@dadei/ui/types/models.types';
import {
  actionBannerMeta,
  actionDisplayTitle,
  actionDomainLabel,
  isNotificationAction,
  resolveActionOperation,
} from '@dadei/ui/utils/actionDisplay';

/** Dedupe by id and keep API order (active first, then pending FIFO). */
export function normalizeNotificationActions(actions: NetworkAction[]): NetworkAction[] {
  const seen = new Set<string>();
  const out: NetworkAction[] = [];
  for (const action of actions) {
    if (action.status !== 'proposed' || !isNotificationAction(action)) continue;
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    out.push(action);
  }
  return out;
}

export function networkActionsToBannerItems(
  actions: NetworkAction[],
  handlers: {
    onReject: (actionId: string) => Promise<void>;
  },
): BannerItem[] {
  return actions.map((action) => {
    const isActive = Boolean(action.is_active ?? action.scheduled_at);
    const queued = !isActive;
    return {
      id: `action:${action.id}`,
      category: actionDomainLabel(action.action_type),
      operation: resolveActionOperation(action),
      actionType: action.action_type,
      title: actionDisplayTitle(action),
      body: actionBannerMeta(action),
      toolArgs: action.tool_args ?? undefined,
      startTime: action.start_time,
      endTime: action.end_time,
      durationMs: AUTO_FIRE_DELAY_MS,
      showCountdown: isActive && Boolean(action.scheduled_at),
      countdownEndsAt: action.scheduled_at ?? undefined,
      queued,
      cancelLabel: 'Cancel',
      onCancel: () => handlers.onReject(action.id),
    };
  });
}
