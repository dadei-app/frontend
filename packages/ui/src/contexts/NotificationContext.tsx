import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import Banner, { type BannerExitMode } from '@dadei/ui/components/notifications/Banner';
import Toast from '@dadei/ui/components/notifications/Toast';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { actionsApi } from '@dadei/ui/lib/api/actions';
import {
  BANNER_ENTER_SPRING,
  BANNER_PUSH_SPRING,
  BANNER_STACK_STAGGER_MS,
  BANNER_ACTIVE_ENTER_TRAVEL_PX,
  bannerPouchTravelPx,
  buildStackBanners,
  stackContainerHeight,
  stackLayoutForSlot,
  type StackBanner,
} from '@dadei/ui/lib/notifications/bannerStack';
import { playNotificationPing } from '@dadei/ui/lib/notifications/notificationSound';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { ToastType, type NetworkAction } from '@dadei/ui/types/models.types';
import {
  networkActionsToBannerItems,
  normalizeNotificationActions,
} from '@dadei/ui/lib/notifications/actionBannerSync';

const DEFAULT_BANNER_DURATION_MS = 10_000;
const STACK_OPACITY_EASE = [0.22, 1, 0.36, 1] as const;
const ACTIVE_ENTER_OPACITY_MS = 0.18;
const MOTION_SETTLE_MS = 650;
const EXITING_Z_INDEX = 10_000;

export type ShowBannerInput = {
  id?: string;
  category?: string;
  operation?: 'create' | 'update' | 'delete';
  title: string;
  body?: string;
  durationMs?: number;
  showCountdown?: boolean;
  countdownEndsAt?: string;
  queued?: boolean;
  cancelLabel?: string;
  onCancel?: () => Promise<void> | void;
  /** Called when the countdown completes, before the banner is removed. */
  onAutoDismiss?: () => Promise<void> | void;
};

export type BannerItem = {
  id: string;
  category?: string;
  operation?: 'create' | 'update' | 'delete';
  actionType?: string;
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
  durationMs: number;
  showCountdown?: boolean;
  countdownEndsAt?: string;
  queued?: boolean;
  cancelLabel?: string;
  onCancel?: () => Promise<void> | void;
  onAutoDismiss?: () => Promise<void> | void;
};

type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
};

type NotificationsContextValue = {
  toasts: ToastMessage[];
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
  banners: BannerItem[];
  showBanner: (input: ShowBannerInput) => string;
  dismissBanner: (id: string) => void;
  dismissBannerById: (id: string) => void;
  actionBanners: BannerItem[];
  manualBanners: BannerItem[];
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const EMPTY_ACTIONS: NetworkAction[] = [];

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Read proposed actions from the React Query cache on every cache notify (no useEffect hop). */
function useProposedActionsFromCache(): NetworkAction[] {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event?.query?.queryKey?.[0] !== queryKeys.actions[0]) return;
        if (event.type === 'updated' || event.type === 'added') {
          onStoreChange();
        }
      }),
    [queryClient],
  );
  const getSnapshot = useCallback(
    () => queryClient.getQueryData<NetworkAction[]>(queryKeys.actions) ?? EMPTY_ACTIONS,
    [queryClient],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useSyncedActionBanners(enabled: boolean): BannerItem[] {
  const queryClient = useQueryClient();
  const actions = useProposedActionsFromCache();

  const rejectAction = useCallback(
    async (actionId: string) => {
      await actionsApi.reject(actionId);
      queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, (prev) =>
        (prev ?? []).filter((item) => item.id !== actionId),
      );
    },
    [queryClient],
  );

  const expireAction = useCallback(
    (actionId: string) => {
      queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, (prev) =>
        (prev ?? []).filter((item) => item.id !== actionId),
      );
    },
    [queryClient],
  );

  return useMemo(() => {
    if (!enabled) return [];
    return networkActionsToBannerItems(normalizeNotificationActions(actions), {
      onReject: rejectAction,
      onExpire: expireAction,
    });
  }, [enabled, actions, rejectAction, expireAction]);
}

export function ToastStackHost({ className = '' }: { className?: string }) {
  const ctx = useContext(NotificationsContext);
  if (!ctx) return null;
  const { toasts, removeToast } = ctx;

  return (
    <div className={`pointer-events-none flex max-w-sm flex-col-reverse gap-2 ${className}`} aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

/** Literal overlapping stack — active on top at the bottom slot; pending rise behind above. */
export function BannerStackHost({ className = '' }: { className?: string }) {
  const ctx = useContext(NotificationsContext);
  if (!ctx) return null;

  const { actionBanners, manualBanners, dismissBannerById } = ctx;

  const slotByIdRef = useRef<Map<string, number>>(new Map());
  const prevStackIdsRef = useRef<string[]>([]);
  const lastKnownRef = useRef<Map<string, StackBanner>>(new Map());
  const mountKeyRef = useRef<Map<string, string>>(new Map());
  const enteringIdsRef = useRef<Map<string, number>>(new Map());
  const pushedIdsRef = useRef<Set<string>>(new Set());
  const [, bumpEnterState] = useState(0);

  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const [dismissedBannerIds, setDismissedBannerIds] = useState<Set<string>>(() => new Set());
  const [exitModeById, setExitModeById] = useState<Map<string, BannerExitMode>>(
    () => new Map(),
  );
  const [exitBarrier, setExitBarrier] = useState(false);

  const stack = useMemo(
    () =>
      buildStackBanners(actionBanners, manualBanners).filter(
        (banner) => !dismissedBannerIds.has(banner.id),
      ),
    [actionBanners, manualBanners, dismissedBannerIds],
  );

  useEffect(() => {
    const liveIds = new Set([
      ...actionBanners.map((banner) => banner.id),
      ...manualBanners.map((banner) => banner.id),
    ]);
    setDismissedBannerIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (liveIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) {
        let unchanged = true;
        for (const id of prev) {
          if (!next.has(id)) {
            unchanged = false;
            break;
          }
        }
        if (unchanged) return prev;
      }
      return next;
    });
  }, [actionBanners, manualBanners]);
  const pingedEnterRef = useRef<Set<string>>(new Set());
  const pendingPingIdsRef = useRef<string[]>([]);

  // Apply stack transitions synchronously so the first paint can mount banners immediately.
  const currentIds = stack.map((b) => b.id);
  const prevIds = prevStackIdsRef.current;
  const stackIdsChanged = prevIds.join('|') !== currentIds.join('|');
  if (stackIdsChanged) {
    const prevIdSet = new Set(prevIds);
    const newIds = currentIds.filter((id) => !prevIdSet.has(id));

    const stampMountKeys = (ids: string[]) => {
      for (const id of ids) {
        if (!mountKeyRef.current.has(id)) {
          mountKeyRef.current.set(id, `${id}:enter:${mountKeyRef.current.size}`);
        }
      }
    };

    if (prevIds.length === 0 && currentIds.length > 0) {
      slotByIdRef.current = new Map(stack.map((b) => [b.id, b.slotFromTop]));
      stampMountKeys(currentIds);
      enteringIdsRef.current = new Map(stack.map((b, index) => [b.id, index]));
      pushedIdsRef.current = new Set();
      pendingPingIdsRef.current = [...newIds];
    } else if (newIds.length > 0) {
      const next = new Map(slotByIdRef.current);
      const bump = newIds.length;
      for (const [id, slot] of next) {
        if (!newIds.includes(id)) {
          next.set(id, slot + bump);
        }
      }
      const enterMap = new Map<string, number>();
      newIds.forEach((id, i) => {
        next.set(id, i);
        enterMap.set(id, i);
      });
      slotByIdRef.current = next;
      stampMountKeys(newIds);
      enteringIdsRef.current = enterMap;
      pushedIdsRef.current = new Set(
        currentIds.filter((id) => !newIds.includes(id) && prevIdSet.has(id)),
      );
      pendingPingIdsRef.current = [...newIds];
    }

    prevStackIdsRef.current = currentIds;
  }

  for (const banner of stack) {
    lastKnownRef.current.set(banner.id, banner);
    if (!mountKeyRef.current.has(banner.id)) {
      mountKeyRef.current.set(banner.id, `${banner.id}:enter:${mountKeyRef.current.size}`);
    }
  }

  const enteringIds = enteringIdsRef.current;
  const pushedIds = pushedIdsRef.current;
  const stackSignature = currentIds.join('|');

  useLayoutEffect(() => {
    if (pendingPingIdsRef.current.length === 0) return;
    const ids = pendingPingIdsRef.current;
    pendingPingIdsRef.current = [];
    for (const id of ids) {
      const key = `${id}:enter`;
      if (pingedEnterRef.current.has(key)) continue;
      pingedEnterRef.current.add(key);
      playNotificationPing();
    }
  });

  useEffect(() => {
    if (enteringIdsRef.current.size === 0 && pushedIdsRef.current.size === 0) return;
    const t = window.setTimeout(() => {
      enteringIdsRef.current = new Map();
      pushedIdsRef.current = new Set();
      bumpEnterState((n) => n + 1);
    }, MOTION_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [stackSignature]);

  const handleExitStart = useCallback((id: string, mode: BannerExitMode) => {
    flushSync(() => {
      setExitBarrier(true);
      setExitingIds((prev) => new Set(prev).add(id));
      setExitModeById((prev) => new Map(prev).set(id, mode));
    });
  }, []);

  const handleExitComplete = useCallback((id: string) => {
    flushSync(() => {
      setDismissedBannerIds((prev) => new Set(prev).add(id));
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        if (next.size === 0) {
          setExitBarrier(false);
        }
        return next;
      });
    });
    slotByIdRef.current.delete(id);
    mountKeyRef.current.delete(id);
    setExitModeById((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  if (stack.length === 0 && exitingIds.size === 0) {
    return (
      <div
        className={`pointer-events-none relative mx-auto w-full max-w-2xl overflow-visible ${className}`}
        style={{ minHeight: 0 }}
        aria-live="polite"
      >
        <AnimatePresence initial={false} />
      </div>
    );
  }

  const stackIds = new Set(stack.map((b) => b.id));
  const itemById = new Map<
    string,
    { banner: StackBanner; slotFromTop: number; isExiting: boolean; enterIndex: number }
  >();

  for (const banner of stack) {
    itemById.set(banner.id, {
      banner,
      slotFromTop: slotByIdRef.current.get(banner.id) ?? banner.slotFromTop,
      isExiting: exitingIds.has(banner.id),
      enterIndex: enteringIds.get(banner.id) ?? 0,
    });
  }

  for (const id of exitingIds) {
    if (stackIds.has(id)) continue;
    const known = lastKnownRef.current.get(id);
    const slot = slotByIdRef.current.get(id);
    if (!known || slot === undefined) continue;
    itemById.set(id, {
      banner: known,
      slotFromTop: slot,
      isExiting: true,
      enterIndex: 0,
    });
  }

  const renderItems = [...itemById.values()].sort((a, b) => a.slotFromTop - b.slotFromTop);

  const maxSlot = renderItems.reduce((max, item) => Math.max(max, item.slotFromTop), 0);
  const totalLayers = Math.max(maxSlot + 1, 1);
  const activeId = stack.find((b) => b.isActive)?.id ?? null;

  return (
    <div
      className={`pointer-events-none relative mx-auto w-full max-w-2xl overflow-visible ${className}`}
      style={{ minHeight: stackContainerHeight(totalLayers) }}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {renderItems.map(({ banner, slotFromTop, isExiting, enterIndex }) => {
          const layout = stackLayoutForSlot(slotFromTop, totalLayers);
          const isActive = banner.isActive && !isExiting;
          const stackDepth = maxSlot - slotFromTop;
          const isNewEntrant = !isExiting && enteringIds.has(banner.id);
          const isPushed = !isExiting && !isNewEntrant && pushedIds.has(banner.id);
          const stagger = enterIndex * (BANNER_STACK_STAGGER_MS / 1000);
          const enterTravel = isActive
            ? BANNER_ACTIVE_ENTER_TRAVEL_PX
            : bannerPouchTravelPx(layout.y);
          const motionKey = mountKeyRef.current.get(banner.id) ?? banner.id;

          const zIndex = isExiting ? EXITING_Z_INDEX : isActive ? 1000 : layout.zIndex;
          const slideUpExit = isExiting && exitModeById.get(banner.id) === 'slide-up';

          return (
            <motion.div
              key={motionKey}
              className="absolute left-0 w-full overflow-visible"
              style={{
                top: 0,
                zIndex,
                transformOrigin: 'top center',
              }}
              initial={
                isExiting
                  ? false
                  : isNewEntrant
                    ? {
                        opacity: 0,
                        y: layout.y - enterTravel,
                        scale: layout.scale * 0.9,
                      }
                    : false
              }
              animate={
                slideUpExit
                  ? {
                      opacity: 0,
                      y: layout.y - enterTravel,
                      scale: layout.scale * 0.9,
                    }
                  : {
                      opacity: 1,
                      y: layout.y,
                      scale: isPushed
                        ? [layout.scale * 1.012, layout.scale * 0.992, layout.scale]
                        : layout.scale,
                    }
              }
              transition={
                slideUpExit
                  ? {
                      opacity: { duration: 0.28, ease: 'easeIn' },
                      y: BANNER_ENTER_SPRING,
                      scale: BANNER_ENTER_SPRING,
                    }
                  : isNewEntrant
                    ? isActive
                      ? {
                          opacity: {
                            duration: ACTIVE_ENTER_OPACITY_MS,
                            ease: STACK_OPACITY_EASE,
                          },
                          y: { ...BANNER_ENTER_SPRING, stiffness: 620, damping: 34 },
                          scale: { ...BANNER_ENTER_SPRING, stiffness: 620, damping: 34 },
                        }
                      : {
                          opacity: {
                            duration: 0.32,
                            ease: STACK_OPACITY_EASE,
                            delay: stagger,
                          },
                          y: { ...BANNER_ENTER_SPRING, delay: stagger },
                          scale: { ...BANNER_ENTER_SPRING, delay: stagger },
                        }
                    : isPushed
                      ? {
                          y: { ...BANNER_PUSH_SPRING, delay: stagger * 0.35 },
                          scale: {
                            duration: 0.48,
                            ease: [0.42, 0, 0.22, 1],
                            delay: stagger * 0.35,
                          },
                        }
                      : {
                          y: BANNER_PUSH_SPRING,
                          scale: BANNER_PUSH_SPRING,
                        }
              }
            >
              <Banner
                id={banner.id}
                category={banner.category}
                operation={banner.operation}
                actionType={banner.actionType}
                title={banner.title}
                body={banner.body}
                toolArgs={banner.toolArgs}
                startTime={banner.startTime}
                endTime={banner.endTime}
                durationMs={banner.durationMs}
                showCountdown={banner.showCountdown}
                countdownEndsAt={banner.countdownEndsAt}
                cancelLabel={banner.cancelLabel}
                onCancel={banner.onCancel}
                onAutoDismiss={banner.onAutoDismiss}
                onDismiss={() => dismissBannerById?.(banner.id)}
                isStackFront={isActive}
                stackDepth={stackDepth}
                queued={banner.queued}
                countdownEnabled={
                  isActive &&
                  activeId === banner.id &&
                  (!exitBarrier || exitingIds.has(banner.id))
                }
                onExitStart={(mode) => handleExitStart(banner.id, mode)}
                onExitComplete={() => handleExitComplete(banner.id)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [manualBanners, setManualBanners] = useState<BannerItem[]>([]);
  const actionBanners = useSyncedActionBanners(isAuthenticated && !isLoading);
  const banners = useMemo(
    () => buildStackBanners(actionBanners, manualBanners),
    [actionBanners, manualBanners],
  );

  useEffect(() => {
    if (isAuthenticated && !isLoading) return;
    queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, []);
  }, [isAuthenticated, isLoading, queryClient]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = newId();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissBannerById = useCallback((id: string) => {
    if (!id.startsWith('action:')) {
      setManualBanners((prev) => prev.filter((b) => b.id !== id));
    }
  }, []);

  const dismissBanner = useCallback(
    (id: string) => {
      dismissBannerById(id);
    },
    [dismissBannerById]
  );

  const showBanner = useCallback((input: ShowBannerInput) => {
    const id = input.id ?? newId();
    const durationMs = input.durationMs ?? DEFAULT_BANNER_DURATION_MS;
    setManualBanners((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const existing = idx >= 0 ? prev[idx] : null;
      const countdownEndsAt =
        input.countdownEndsAt ??
        (input.showCountdown
          ? (existing?.countdownEndsAt ??
            new Date(Date.now() + durationMs).toISOString())
          : existing?.countdownEndsAt);
      const next: BannerItem = {
        id,
        category: input.category,
        operation: input.operation,
        title: input.title,
        body: input.body,
        durationMs,
        showCountdown: input.showCountdown,
        countdownEndsAt,
        cancelLabel: input.cancelLabel,
        onCancel: input.onCancel,
        onAutoDismiss: input.onAutoDismiss,
      };
      if (idx === -1) return [...prev, next];
      const updated = [...prev];
      updated[idx] = next;
      return updated;
    });
    return id;
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      showToast,
      removeToast,
      banners,
      showBanner,
      dismissBanner,
      dismissBannerById,
      actionBanners,
      manualBanners,
    }),
    [toasts, showToast, removeToast, banners, showBanner, dismissBanner, dismissBannerById, actionBanners, manualBanners]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}
