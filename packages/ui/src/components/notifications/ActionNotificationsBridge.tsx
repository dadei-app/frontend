import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { actionsApi } from '@dadei/ui/lib/api/actions';
import { AUTO_FIRE_DELAY_MS } from '@dadei/ui/lib/notificationConstants';
import { playNotificationPing } from '@dadei/ui/lib/notificationSound';
import { queryKeys } from '@dadei/ui/lib/queryKeys';
import { useActionsQuery } from '@dadei/ui/lib/queryHooks';
import type { NetworkAction } from '@dadei/ui/types/models.types';

const ACTION_LABELS: Record<string, string> = {
  calendar_event: 'Calendar event',
  task: 'Task',
  reminder: 'Reminder',
  email: 'Email',
};

export function ActionNotificationsBridge({ enabled = true }: { enabled?: boolean }) {
  const { data: actions } = useActionsQuery(enabled);
  const queryClient = useQueryClient();
  const { showBanner, dismissBannerById } = useNotifications();

  const activeActions = useMemo<NetworkAction[]>(
    () => (actions ?? []).filter((a) => a.status === 'proposed' && a.scheduled_at !== null),
    [actions],
  );

  const seenActionIdsRef = useRef<Set<string>>(new Set());
  const activeBannerIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const current = new Set(activeActions.map((a) => a.id));
    let hasNew = false;
    for (const id of current) {
      if (!seenActionIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    seenActionIdsRef.current = current;
    if (hasNew) playNotificationPing();
  }, [activeActions]);

  useEffect(() => {
    const currentBannerIds = new Set<string>();

    for (const action of activeActions) {
      const bannerId = `action:${action.id}`;
      currentBannerIds.add(bannerId);
      const label = ACTION_LABELS[action.action_type] ?? action.action_type;
      const title = action.title?.trim() || label;
      showBanner({
        id: bannerId,
        category: label,
        title,
        body: buildMeta(action),
        durationMs: AUTO_FIRE_DELAY_MS,
        showCountdown: true,
        countdownEndsAt: action.scheduled_at || undefined,
        cancelLabel: 'Cancel',
        onCancel: async () => {
          const updated = await actionsApi.reject(action.id);
          queryClient.setQueriesData<NetworkAction[]>(
            { queryKey: queryKeys.actions },
            (prev) => {
              if (!prev) return prev;
              const idx = prev.findIndex((item) => item.id === updated.id);
              if (idx === -1) return prev;
              const next = [...prev];
              next[idx] = updated;
              return next;
            },
          );
          dismissBannerById(bannerId);
        },
      });
    }

    for (const bannerId of activeBannerIdsRef.current) {
      if (!currentBannerIds.has(bannerId)) {
        dismissBannerById(bannerId);
      }
    }

    activeBannerIdsRef.current = currentBannerIds;
  }, [activeActions, showBanner, dismissBannerById, queryClient]);

  return null;
}

function buildMeta(action: NetworkAction): string | undefined {
  const parts: string[] = [];
  if (action.start_time) parts.push(formatDateTime(action.start_time));

  if (action.details) {
    try {
      const parsed = JSON.parse(action.details) as {
        tool_args?: { description?: string; body?: string; notes?: string; to?: string };
      };
      const detail =
        parsed.tool_args?.description ||
        parsed.tool_args?.body ||
        parsed.tool_args?.notes ||
        parsed.tool_args?.to;
      if (detail) parts.push(truncate(detail, 80));
    } catch {
      // ignore non-json details
    }
  }
  return parts.length ? parts.join(' · ') : undefined;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}
