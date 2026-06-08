import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import Banner from '@dadei/ui/components/notifications/Banner';
import Toast from '@dadei/ui/components/notifications/Toast';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { actionsApi } from '@dadei/ui/lib/api/actions';
import {
  BANNER_ENTER_SPRING,
  BANNER_ENTER_TRAVEL_MULT,
  BANNER_LAYER_STEP_PX,
  BANNER_PUSH_SPRING,
  BANNER_STACK_STAGGER_MS,
  buildStackBanners,
  stackContainerHeight,
  stackLayoutForSlot,
  type StackBanner,
} from '@dadei/ui/lib/notifications/bannerStack';
import { playNotificationPing } from '@dadei/ui/lib/notifications/notificationSound';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { ToastType, type NetworkAction } from '@dadei/ui/types/models.types';
import { TUTORIAL_TEST_TOAST_MESSAGE } from '@dadei/ui/components/tutorial/constants';
import {
  networkActionsToBannerItems,
  normalizeNotificationActions,
} from '@dadei/ui/lib/notifications/actionBannerSync';

const DEFAULT_BANNER_DURATION_MS = 10_000;
const STACK_OPACITY_EASE = [0.22, 1, 0.36, 1] as const;
const MOTION_SETTLE_MS = 650;

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
  title: string;
  body?: string;
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

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Push-only mirror of `queryKeys.actions` (filled by ServiceContext realtime handlers). */
function useNotificationActionsFromCache() {
  const queryClient = useQueryClient();
  const [actions, setActions] = useState<NetworkAction[]>(
    () => queryClient.getQueryData<NetworkAction[]>(queryKeys.actions) ?? [],
  );

  useEffect(() => {
    const key = queryKeys.actions;
    const sync = () => {
      setActions(queryClient.getQueryData<NetworkAction[]>(key) ?? []);
    };
    sync();
    return queryClient.getQueryCache().subscribe(event => {
      if (event?.query?.queryKey?.[0] !== key[0]) return;
      if (event.type === 'updated' || event.type === 'added') {
        sync();
      }
    });
  }, [queryClient]);

  return { data: actions };
}

/** Replaces action banners from the actions query (single source of truth, no duplicates). */
function useActionBannerSync(
  enabled: boolean,
  setActionBanners: (items: BannerItem[]) => void,
) {
  const queryClient = useQueryClient();
  const { data: actions } = useNotificationActionsFromCache();

  const notificationActions = useMemo(
    () => normalizeNotificationActions(actions ?? []),
    [actions],
  );

  const seenActionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const current = new Set(notificationActions.map((a) => a.id));
    let hasNew = false;
    for (const id of current) {
      if (!seenActionIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    seenActionIdsRef.current = current;
    if (hasNew) playNotificationPing();
  }, [notificationActions]);

  const rejectAction = useCallback(
    async (actionId: string) => {
      await actionsApi.reject(actionId);
      queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, (prev) =>
        (prev ?? []).filter((item) => item.id !== actionId),
      );
    },
    [queryClient],
  );

  useEffect(() => {
    if (!enabled) {
      setActionBanners([]);
      return;
    }
    setActionBanners(
      networkActionsToBannerItems(notificationActions, { onReject: rejectAction }),
    );
  }, [enabled, notificationActions, rejectAction, setActionBanners]);

  useEffect(() => {
    if (!enabled) {
      queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, []);
    }
  }, [enabled, queryClient]);
}

export function ToastStackHost({ className = '' }: { className?: string }) {
  const ctx = useContext(NotificationsContext);
  if (!ctx) return null;
  const { toasts, removeToast } = ctx;

  return (
    <div className={`pointer-events-none flex max-w-sm flex-col-reverse gap-2 ${className}`} aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
          {...(toast.message === TUTORIAL_TEST_TOAST_MESSAGE
            ? { 'data-tutorial-target': 'tutorial-test-toast' }
            : {})}
        >
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

  const stack = useMemo(
    () => buildStackBanners(actionBanners, manualBanners),
    [actionBanners, manualBanners],
  );

  const slotByIdRef = useRef<Map<string, number>>(new Map());
  const prevStackIdsRef = useRef<string[]>([]);
  const lastKnownRef = useRef<Map<string, StackBanner>>(new Map());
  const newEnterIndexRef = useRef<Map<string, number>>(new Map());
  const pushedIdsRef = useRef<Set<string>>(new Set());

  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const [exitBarrier, setExitBarrier] = useState(false);

  useEffect(() => {
    for (const banner of stack) {
      lastKnownRef.current.set(banner.id, banner);
    }

    const currentIds = stack.map((b) => b.id);
    const prevIds = prevStackIdsRef.current;
    const prevIdSet = new Set(prevIds);
    const newIds = currentIds.filter((id) => !prevIdSet.has(id));

    if (prevIds.length === 0 && currentIds.length > 0) {
      const initial = new Map<string, number>();
      stack.forEach((b) => initial.set(b.id, b.slotFromTop));
      slotByIdRef.current = initial;
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
      newEnterIndexRef.current = enterMap;
      pushedIdsRef.current = new Set(
        currentIds.filter((id) => !newIds.includes(id) && prevIdSet.has(id)),
      );
    }

    prevStackIdsRef.current = currentIds;
  }, [stack]);

  useEffect(() => {
    if (newEnterIndexRef.current.size === 0 && pushedIdsRef.current.size === 0) return;
    const t = window.setTimeout(() => {
      newEnterIndexRef.current = new Map();
      pushedIdsRef.current = new Set();
    }, MOTION_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [stack]);

  const handleExitStart = useCallback((id: string) => {
    setExitBarrier(true);
    setExitingIds((prev) => new Set(prev).add(id));
  }, []);

  const handleExitComplete = useCallback((id: string) => {
    setExitingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      if (next.size === 0) {
        setExitBarrier(false);
      }
      return next;
    });
    slotByIdRef.current.delete(id);
  }, []);

  if (stack.length === 0 && exitingIds.size === 0) return null;

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
      enterIndex: newEnterIndexRef.current.get(banner.id) ?? 0,
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
  const totalLayers = maxSlot + 1;
  const activeId = stack.find((b) => b.isActive)?.id ?? null;

  return (
    <div
      className={`pointer-events-none relative mx-auto w-full max-w-xl ${className}`}
      style={{ minHeight: stackContainerHeight(totalLayers) }}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {renderItems.map(({ banner, slotFromTop, isExiting, enterIndex }) => {
          const layout = stackLayoutForSlot(slotFromTop, totalLayers);
          const isActive = banner.isActive && !isExiting;
          const stackDepth = maxSlot - slotFromTop;
          const activeZ = 1000;
          const isNewEntrant = !isExiting && newEnterIndexRef.current.has(banner.id);
          const isPushed = !isExiting && !isNewEntrant && pushedIdsRef.current.has(banner.id);
          const stagger = enterIndex * (BANNER_STACK_STAGGER_MS / 1000);
          const enterTravel = BANNER_LAYER_STEP_PX * BANNER_ENTER_TRAVEL_MULT;

          return (
            <motion.div
              key={banner.id}
              className="absolute left-0 w-full"
              style={{
                top: 0,
                zIndex: isActive ? activeZ : layout.zIndex,
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
              animate={{
                opacity: 1,
                y: layout.y,
                scale: isPushed
                  ? [layout.scale * 1.012, layout.scale * 0.992, layout.scale]
                  : layout.scale,
              }}
              exit={{ opacity: 0 }}
              transition={
                isNewEntrant
                  ? {
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
                title={banner.title}
                body={banner.body}
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
                countdownEnabled={isActive && activeId === banner.id && !exitBarrier}
                onExitStart={() => handleExitStart(banner.id)}
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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [manualBanners, setManualBanners] = useState<BannerItem[]>([]);
  const [actionBanners, setActionBanners] = useState<BannerItem[]>([]);
  const banners = useMemo(
    () => buildStackBanners(actionBanners, manualBanners),
    [actionBanners, manualBanners],
  );

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = newId();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissBannerById = useCallback((id: string) => {
    setActionBanners((prev) => prev.filter((b) => b.id !== id));
    setManualBanners((prev) => prev.filter((b) => b.id !== id));
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
      const next: BannerItem = {
        id,
        category: input.category,
        operation: input.operation,
        title: input.title,
        body: input.body,
        durationMs,
        showCountdown: input.showCountdown,
        countdownEndsAt: input.countdownEndsAt,
        cancelLabel: input.cancelLabel,
        onCancel: input.onCancel,
        onAutoDismiss: input.onAutoDismiss,
      };
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return [...prev, next];
      const updated = [...prev];
      updated[idx] = next;
      return updated;
    });
    return id;
  }, []);

  useActionBannerSync(isAuthenticated && !isLoading, setActionBanners);

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
