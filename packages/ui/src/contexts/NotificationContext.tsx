import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence } from 'framer-motion';
import Banner from '@dadei/ui/components/ui/Banner';
import Toast from '@dadei/ui/components/ui/Toast';
import { ToastType } from '@dadei/ui/types/models.types';

const DEFAULT_BANNER_DURATION_MS = 10_000;

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

function ToastStackHost() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) return null;
  const { toasts, removeToast } = ctx;

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-180 flex max-w-sm flex-col-reverse gap-2"
      aria-live="polite"
    >
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

function BannerStackHost() {
  const ctx = useContext(NotificationsContext);
  if (!ctx || ctx.banners.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[260] flex w-[min(22rem,92vw)] flex-col gap-2" aria-live="polite">
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

  const dismissBanner = useCallback((id: string) => {
    dismissBannerById(id);
  }, [dismissBannerById]);

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
      <BannerStackHost />
      <ToastStackHost />
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
