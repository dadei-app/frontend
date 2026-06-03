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
import StackedNotificationBanners from '@dadei/ui/components/notifications/StackedNotificationBanners';
import Toast from '@dadei/ui/components/ui/Toast';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { actionsApi } from '@dadei/ui/lib/api/actions';
import { playNotificationPing } from '@dadei/ui/lib/notifications/notificationSound';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { useNotificationActionsQuery } from '@dadei/ui/lib/query/queryHooks';
import { ToastType, type NetworkAction } from '@dadei/ui/types/models.types';
import {
  networkActionsToBannerItems,
  normalizeNotificationActions,
} from '@dadei/ui/lib/notifications/actionBannerSync';

const DEFAULT_BANNER_DURATION_MS = 10_000;

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

/** Replaces action banners from the actions query (single source of truth, no duplicates). */
function useActionBannerSync(
  enabled: boolean,
  setActionBanners: (items: BannerItem[]) => void,
) {
  const queryClient = useQueryClient();
  const { data: actions } = useNotificationActionsQuery();

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
    <StackedNotificationBanners
      className={className}
      banners={ctx.banners}
      onDismiss={ctx.dismissBannerById}
    />
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