import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export interface BannerProps {
  id: string;
  category?: string;
  title: string;
  body?: string;
  durationMs: number;
  showCountdown?: boolean;
  countdownEndsAt?: string;
  cancelLabel?: string;
  onCancel?: () => Promise<void> | void;
  onDismiss: () => void;
}

export default function Banner({
  id,
  category,
  title,
  body,
  durationMs,
  showCountdown,
  countdownEndsAt,
  cancelLabel,
  onCancel,
  onDismiss,
}: BannerProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    const end = countdownEndsAt ? new Date(countdownEndsAt).getTime() : (now + durationMs);
    const delay = Math.max(end - now, 0);
    const t = window.setTimeout(() => onDismiss(), delay);
    return () => window.clearTimeout(t);
  }, [id, durationMs, countdownEndsAt, onDismiss]);

  const handleCancel = async () => {
    if (!onCancel || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      await onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel');
      setCancelling(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.985 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto group relative w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950/95 backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.7)] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:border-white/[0.10] hover:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_28px_70px_-20px_rgba(0,0,0,0.78)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
      {showCountdown ? <CountdownBar durationMs={durationMs} countdownEndsAt={countdownEndsAt} /> : null}
      <div className="flex items-center gap-4 px-4 py-3.5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500/90 font-secondary">
            {category || 'Notification'}
          </p>
          <p className="mt-1 truncate text-sm font-semibold leading-snug text-zinc-100">{title}</p>
          {body ? (
            <p className="mt-0.5 truncate text-xs leading-relaxed text-zinc-400/90 font-secondary">
              {body}
            </p>
          ) : null}
          {error ? <p className="mt-1 text-xs text-red-400/90 font-secondary">{error}</p> : null}
        </div>
        {onCancel ? (
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition duration-200 hover:bg-white/[0.04] hover:text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
            >
              {cancelling ? 'Cancelling…' : (cancelLabel || 'Cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function CountdownBar({ durationMs, countdownEndsAt }: { durationMs: number; countdownEndsAt?: string }) {
  const { initialScaleX, remainingSec } = useMemo(() => {
    const now = Date.now();
    const endMs = countdownEndsAt ? new Date(countdownEndsAt).getTime() : (now + durationMs);
    const remainingMs = Math.max(endMs - now, 0);
    const remainingRatio = Math.min(remainingMs / durationMs, 1);
    return {
      initialScaleX: remainingRatio,
      remainingSec: remainingMs / 1000,
    };
  }, [countdownEndsAt, durationMs]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden">
      <motion.div
        initial={{ scaleX: initialScaleX, originX: 1 }}
        animate={{ scaleX: 0, originX: 1 }}
        transition={{ duration: remainingSec, ease: 'linear' }}
        className="h-full origin-right bg-gradient-to-r from-zinc-500/40 via-zinc-200/80 to-zinc-100"
        style={{ boxShadow: '0 0 10px rgba(255,255,255,0.18)' }}
      />
    </div>
  );
}
