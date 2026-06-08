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
import { playNotificationPing } from '@dadei/ui/lib/notifications/notificationSound';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { ToastType, type NetworkAction } from '@dadei/ui/types/models.types';
import { TUTORIAL_TEST_TOAST_MESSAGE } from '@dadei/ui/components/tutorial/constants';
import {
  networkActionsToBannerItems,
  normalizeNotificationActions,
} from '@dadei/ui/lib/notifications/actionBannerSync';

const DEFAULT_BANNER_DURATION_MS = 10_000;
const STACK_PEEK_PX = 11;
const STACK_SCALE_STEP = 0.028;
const STACK_MAX_VISIBLE = 4;

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

/** Front banner (index 0) is interactive; deeper cards peek beneath with blur. */
export function BannerStackHost({ className = '' }: { className?: string }) {
  const ctx = useContext(NotificationsContext);
  if (!ctx || ctx.banners.length === 0) return null;

  const { banners, dismissBannerById } = ctx;
  const visible = banners.slice(0, STACK_MAX_VISIBLE);
  const overflow = banners.length - visible.length;
  const stackHeight =
    72 + Math.max(visible.length - 1, 0) * STACK_PEEK_PX + (overflow > 0 ? 18 : 0);

  return (
    <div
      className={`pointer-events-none relative w-full max-w-xl ${className}`}
      style={{ minHeight: stackHeight }}
      aria-live="polite"
    >
      {overflow > 0 ? (
        <p className="pointer-events-none absolute right-0 bottom-0 text-[10px] font-medium tracking-wide text-zinc-500/90 font-secondary">
          +{overflow} more
        </p>
      ) : null}
      <AnimatePresence initial={false}>
        {visible.map((banner, index) => {
          const depth = index;
          const isFront = depth === 0;
          const y = depth * STACK_PEEK_PX;
          const scale = 1 - depth * STACK_SCALE_STEP;
          const stackBlurPx = isFront ? 0 : Math.min(4 + depth * 5, 18);

          return (
            <motion.div
              key={banner.id}
              layout
              className="absolute left-0 w-full"
              style={{
                top: 0,
                zIndex: visible.length - depth,
                transformOrigin: 'top center',
              }}
              initial={{ opacity: 0, y: -28, scale: 0.94, filter: 'blur(10px)' }}
              animate={{
                opacity: 1,
                y,
                scale,
                filter: stackBlurPx > 0 ? `blur(${stackBlurPx}px)` : 'blur(0px)',
              }}
              exit={{
                opacity: 0,
                y: -40,
                scale: scale * 0.96,
                filter: 'blur(12px)',
                transition: { duration: 0.35 },
              }}
              transition={{
                layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.35 },
                y: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                scale: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                filter: { duration: 0.4 },
              }}
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
                onDismiss={() => dismissBannerById(banner.id)}
                isStackFront={isFront}
                stackDepth={depth}
                queued={banner.queued}
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
    () => [...actionBanners, ...manualBanners.filter((m) => !actionBanners.some((a) => a.id === m.id))],
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
    }),
    [toasts, showToast, removeToast, banners, showBanner, dismissBanner, dismissBannerById]
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