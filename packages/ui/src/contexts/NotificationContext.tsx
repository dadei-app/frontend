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
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import Banner from '@dadei/ui/components/ui/Banner';
import Toast from '@dadei/ui/components/ui/Toast';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { actionsApi } from '@dadei/ui/lib/api/actions';
import { AUTO_FIRE_DELAY_MS } from '@dadei/ui/lib/notificationConstants';
import { playNotificationPing } from '@dadei/ui/lib/notificationSound';
import { queryKeys } from '@dadei/ui/lib/queryKeys';
import { useActionsQuery } from '@dadei/ui/lib/queryHooks';
import { ToastType, type NetworkAction } from '@dadei/ui/types/models.types';

const DEFAULT_BANNER_DURATION_MS = 10_000;

const ACTION_LABELS: Record<string, string> = {
  calendar: 'Calendar event',
  calendar_event: 'Calendar event',
  todo: 'Task',
  task: 'Task',
  reminder: 'Reminder',
  email: 'Email',
};

export type ShowBannerInput = {
  id?: string;
  category?: string;
  title: string;
  body?: string;
  durationMs?: number;
  showCountdown?: boolean;
  countdownEndsAt?: string;
  cancelLabel?: string;
  onCancel?: () => Promise<void> | void;
};

export type BannerItem = {
  id: string;
  category?: string;
  title: string;
  body?: string;
  durationMs: number;
  showCountdown?: boolean;
  countdownEndsAt?: string;
  cancelLabel?: string;
  onCancel?: () => Promise<void> | void;
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

function formatActionDateTime(iso: string): string {
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

function truncateText(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function buildActionBannerMeta(action: NetworkAction): string | undefined {
  const parts: string[] = [];
  if (action.start_time) parts.push(formatActionDateTime(action.start_time));

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
      if (detail) parts.push(truncateText(detail, 80));
    } catch {
      // ignore non-json details
    }
  }
  return parts.length ? parts.join(' · ') : undefined;
}

/** Keeps proposed action banners in sync with the actions query while authenticated. */
function useActionBannerSync(
  enabled: boolean,
  showBanner: (input: ShowBannerInput) => string,
  dismissBannerById: (id: string) => void,
) {
  const queryClient = useQueryClient();
  const { data: actions } = useActionsQuery(enabled);

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
        body: buildActionBannerMeta(action),
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

export function BannerStackHost({ className = '' }: { className?: string }) {
  const ctx = useContext(NotificationsContext);
  if (!ctx || ctx.banners.length === 0) return null;

  return (
    <div
      className={`pointer-events-none flex w-full flex-col gap-2 ${className}`}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {ctx.banners.map((banner) => (
          <Banner
            key={banner.id}
            id={banner.id}
            category={banner.category}
            title={banner.title}
            body={banner.body}
            durationMs={banner.durationMs}
            showCountdown={banner.showCountdown}
            countdownEndsAt={banner.countdownEndsAt}
            cancelLabel={banner.cancelLabel}
            onCancel={banner.onCancel}
            onDismiss={() => ctx.dismissBannerById(banner.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = newId();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissBannerById = useCallback((id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
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
    setBanners((prev) => {
      const next: BannerItem = {
        id,
        category: input.category,
        title: input.title,
        body: input.body,
        durationMs,
        showCountdown: input.showCountdown,
        countdownEndsAt: input.countdownEndsAt,
        cancelLabel: input.cancelLabel,
        onCancel: input.onCancel,
      };
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return [...prev, next];
      const updated = [...prev];
      updated[idx] = next;
      return updated;
    });
    return id;
  }, []);

  useActionBannerSync(isAuthenticated && !isLoading, showBanner, dismissBannerById);

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