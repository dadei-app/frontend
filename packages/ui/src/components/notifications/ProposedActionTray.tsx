import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import type { NetworkAction } from '@dadei/ui/types/models.types';
import { ProposedActionBanner } from './ProposedActionBanner';
import { playNotificationPing } from '@dadei/ui/lib/notificationSound';
import { useActionsQuery } from '@dadei/ui/lib/queryHooks';

/**
 * Renders all currently-proposed actions as a stack in the bottom-right.
 * Plays a ping when a new proposed action appears.
 */
export function ProposedActionTray() {
  const { data: actions } = useActionsQuery(true);
  const proposed = useMemo<NetworkAction[]>(
    () => (actions ?? []).filter(a => a.status === 'proposed' && a.scheduled_at !== null),
    [actions],
  );

  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(proposed.map(a => a.id));
    let isNew = false;
    for (const id of currentIds) {
      if (!seenIdsRef.current.has(id)) {
        isNew = true;
        break;
      }
    }
    seenIdsRef.current = currentIds;
    if (isNew) playNotificationPing();
  }, [proposed]);

  if (proposed.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[260] flex w-[min(22rem,92vw)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {proposed.map(action => (
          <div key={action.id} className="pointer-events-auto">
            <ProposedActionBanner
              action={action}
              onResolved={() => {
                // Resolution updates flow back through realtime query updates.
              }}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
