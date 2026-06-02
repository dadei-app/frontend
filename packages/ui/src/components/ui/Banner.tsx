import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { parseApiDateTimeMs } from '@dadei/ui/lib/shared/parseApiDateTime';

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

const ENTER_EASE = [0.16, 1, 0.3, 1] as const;
const EXPIRE_EASE = [0.4, 0, 0.2, 1] as const;
const CRUMBLE_EASE = [0.7, 0, 0.84, 0] as const;
const CRUMBLE_DURATION_MS = 520;

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
  const [exitMode, setExitMode] = useState<'expire' | 'cancel'>('expire');

  // Unique filter id per instance so multiple banners don't share displacement state.
  const rawId = useId();
  const filterId = `dadei-crumble-${rawId.replace(/:/g, '')}`;
  const displaceRef = useRef<SVGFEDisplacementMapElement>(null);
  const crumbleStartedRef = useRef(false);

  // Auto-expiry timer.
  useEffect(() => {
    const now = Date.now();
    const end = countdownEndsAt ? parseApiDateTimeMs(countdownEndsAt) : now + durationMs;
    const delay = Math.max(end - now, 0);
    const t = window.setTimeout(() => onDismiss(), delay);
    return () => window.clearTimeout(t);
  }, [id, durationMs, countdownEndsAt, onDismiss]);

  // Drive the SVG displacement scale during the crumble exit.
  // Framer can't animate SVG attribute values, so we rAF it manually.
  useEffect(() => {
    if (exitMode !== 'cancel' || crumbleStartedRef.current) return;
    crumbleStartedRef.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / CRUMBLE_DURATION_MS, 1);
      // Ease-in (quadratic) so the banner sits still, then violently breaks apart.
      const eased = progress * progress;
      if (displaceRef.current) {
        displaceRef.current.setAttribute('scale', String(eased * 110));
      }
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [exitMode]);

  const handleCancel = async () => {
    if (!onCancel || cancelling) return;
    setCancelling(true);
    setError(null);
    // Set the exit variant BEFORE awaiting so the next render captures it.
    // The parent will dismiss after onCancel resolves; framer reads the latest exit prop at unmount.
    setExitMode('cancel');
    try {
      await onCancel();
    } catch (e) {
      // Cancel failed — restore the banner, drop the crumble intent.
      setError(e instanceof Error ? e.message : 'Failed to cancel');
      setExitMode('expire');
      crumbleStartedRef.current = false;
      setCancelling(false);
    }
  };

  const variants = {
    enter: { opacity: 0, y: -40, scale: 0.96, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.55, ease: ENTER_EASE },
    },
    expire: {
      opacity: 0,
      y: -72,
      scale: 0.98,
      transition: { duration: 0.5, ease: EXPIRE_EASE },
    },
    cancel: {
      opacity: 0,
      scale: 0.92,
      transition: { duration: CRUMBLE_DURATION_MS / 1000, ease: CRUMBLE_EASE },
    },
  };

  return (
    <>
      {/* Crumble filter — defined inline per-instance, invisible. */}
      <svg
        aria-hidden
        width="0"
        height="0"
        style={{ position: 'absolute', pointerEvents: 'none' }}
      >
        <defs>
          <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.025"
              numOctaves="3"
              seed="7"
            />
            <feDisplacementMap ref={displaceRef} in="SourceGraphic" scale="0" />
          </filter>
        </defs>
      </svg>

      <motion.div
        layout
        initial="enter"
        animate="visible"
        exit={exitMode}
        variants={variants}
        style={{
          filter: exitMode === 'cancel' ? `url(#${filterId})` : undefined,
          willChange: 'transform, opacity, filter',
        }}
        className="pointer-events-auto group relative w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900/82 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_16px_44px_-22px_rgba(0,0,0,0.72)] transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/14 hover:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_18px_48px_-22px_rgba(0,0,0,0.78)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-zinc-200/20 to-transparent" />
        {showCountdown ? (
          <CountdownBar durationMs={durationMs} countdownEndsAt={countdownEndsAt} />
        ) : null}
        <div className="flex items-center gap-4 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400/90 font-secondary">
              {category || 'Notification'}
            </p>
            <p className="mt-1 truncate text-sm font-semibold leading-snug text-zinc-100">
              {title}
            </p>
            {body ? (
              <p className="mt-0.5 truncate text-xs leading-relaxed text-zinc-400 font-secondary">
                {body}
              </p>
            ) : null}
            {error ? (
              <p className="mt-1 text-xs text-red-400/90 font-secondary">{error}</p>
            ) : null}
          </div>
          {onCancel ? (
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition duration-200 hover:bg-white/4 hover:text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
              >
                {cancelling ? 'Cancelling…' : cancelLabel || 'Cancel'}
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
    </>
  );
}

function CountdownBar({
  durationMs,
  countdownEndsAt,
}: {
  durationMs: number;
  countdownEndsAt?: string;
}) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const windowMs = Math.max(durationMs, 1);
    const endMs = countdownEndsAt
      ? parseApiDateTimeMs(countdownEndsAt)
      : Date.now() + windowMs;

    if (!Number.isFinite(endMs)) {
      setProgress(0);
      return;
    }

    let raf = 0;
    const tick = () => {
      const remainingMs = Math.max(endMs - Date.now(), 0);
      setProgress(Math.min(remainingMs / windowMs, 1));
      if (remainingMs > 0) {
        raf = requestAnimationFrame(tick);
      }
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, [countdownEndsAt, durationMs]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-white/6"
      aria-hidden
    >
      <div
        className="absolute inset-y-0 left-0 bg-zinc-100"
        style={{
          width: `${progress * 100}%`,
          willChange: 'width',
        }}
      />
    </div>
  );
}