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
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import Toast from '@dadei/ui/components/ui/Toast';
import { cn } from '@dadei/ui/lib/cn';
import { teardropEnter, teardropExit } from '@dadei/ui/lib/motion';
import { ToastType } from '@dadei/ui/types/models.types';

const DEFAULT_BANNER_DURATION_MS = 10_000;

export type ShowBannerInput = {
  id?: string;
  title: string;
  body?: string;
  durationMs?: number;
};

export type BannerItem = {
  id: string;
  title: string;
  body?: string;
  durationMs: number;
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
  banner: BannerItem | null;
  showBanner: (input: ShowBannerInput) => string;
  dismissBanner: () => void;
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

export function NotificationBannerSlot
({ className }: { className?: string }) {
  const ctx = useContext(NotificationsContext);
  const prefersReducedMotion = useReducedMotion();
  const banner = ctx?.banner ?? null;
  const dismissBanner = ctx?.dismissBanner;

  useEffect(() => {
    if (!banner || !dismissBanner) return;
    const t = window.setTimeout(dismissBanner, banner.durationMs);
    return () => window.clearTimeout(t);
  }, [banner?.id, banner?.durationMs, dismissBanner]);

  if (!ctx) return null;

  const enter = prefersReducedMotion ? { duration: 0.12 } : teardropEnter;
  const exitTr = prefersReducedMotion ? { duration: 0.1 } : teardropExit;

  return (
    <div className={cn('min-h-0 shrink-0', className)} aria-live="polite">
      <AnimatePresence initial={false} mode="wait">
        {banner ? (
          <motion.div
            key={banner.id}
            layout
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -8, scale: 0.98, transformOrigin: '50% 0%' }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0, transition: exitTr }
                : { opacity: 0, y: -6, scale: 0.98, transformOrigin: '50% 0%', transition: exitTr }
            }
            transition={enter}
            className="mb-4 w-full"
          >
            <div className="relative flex w-full gap-3 overflow-hidden rounded-2xl border border-emerald-500/30 bg-zinc-900/88 px-4 py-3 pr-10 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div
                className="mt-0.5 min-w-0 flex-1 pt-0.5"
                role="status"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/85 font-secondary">
                  Notification
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-snug text-zinc-50">{banner.title}</p>
                {banner.body ? (
                  <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-zinc-400 font-secondary">
                    {banner.body}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={dismissBanner}
                className="absolute right-2 top-2 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  /** FIFO: only the head is shown; advancing is dismiss or duration expiry (see NotificationBannerSlot). */
  const [bannerQueue, setBannerQueue] = useState<BannerItem[]>([]);

  const banner = bannerQueue.length > 0 ? bannerQueue[0] : null;

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = newId();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerQueue((prev) => prev.slice(1));
  }, []);

  const showBanner = useCallback((input: ShowBannerInput) => {
    const id = input.id ?? newId();
    const durationMs = input.durationMs ?? DEFAULT_BANNER_DURATION_MS;
    setBannerQueue((prev) => {
      if (prev.some((b) => b.id === id)) return prev;
      return [...prev, { id, title: input.title, body: input.body, durationMs }];
    });
    return id;
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      showToast,
      removeToast,
      banner,
      showBanner,
      dismissBanner,
    }),
    [toasts, showToast, removeToast, banner, showBanner, dismissBanner]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
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
