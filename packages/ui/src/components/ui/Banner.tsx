import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { parseApiDateTimeMs } from '@dadei/ui/lib/shared/parseApiDateTime';
import type { ActionOperation } from '@dadei/ui/types/models.types';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import {
  actionOperationLabel,
  NEUTRAL_BANNER_THEME,
  OPERATION_BANNER_THEME,
} from '@dadei/ui/utils/actionDisplay';

export interface BannerProps {
  id: string;
  category?: string;
  operation?: ActionOperation;
  title: string;
  body?: string;
  durationMs: number;
  showCountdown?: boolean;
  countdownEndsAt?: string;
  cancelLabel?: string;
  onCancel?: () => Promise<void> | void;
  onDismiss: () => void;
  /** Top of stack — only front card runs countdown auto-dismiss. */
  isStackFront?: boolean;
  stackDepth?: number;
  /** Waiting in serial queue behind the active countdown. */
  queued?: boolean;
}

const ENTER_EASE = [0.16, 1, 0.3, 1] as const;
const EXPIRE_EASE = [0.4, 0, 0.2, 1] as const;
const CRUMBLE_EASE = [0.7, 0, 0.84, 0] as const;
const CRUMBLE_DURATION_MS = 520;

export default function Banner({
  id,
  category,
  operation,
  title,
  body,
  durationMs,
  showCountdown,
  countdownEndsAt,
  cancelLabel,
  onCancel,
  onDismiss,
  isStackFront = true,
  stackDepth = 0,
  queued = false,
}: BannerProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitMode, setExitMode] = useState<'expire' | 'cancel'>('expire');

  const theme = operation ? OPERATION_BANNER_THEME[operation] : NEUTRAL_BANNER_THEME;

  const rawId = useId();
  const filterId = `dadei-crumble-${rawId.replace(/:/g, '')}`;
  const displaceRef = useRef<SVGFEDisplacementMapElement>(null);
  const crumbleStartedRef = useRef(false);

  useEffect(() => {
    // Action approval banners are removed when the server queue updates, not on a local timer.
    if (!isStackFront || !showCountdown || queued || id.startsWith('action:')) return;
    const now = Date.now();
    const end = countdownEndsAt ? parseApiDateTimeMs(countdownEndsAt) : now + durationMs;
    const delay = Math.max(end - now, 0);
    const t = window.setTimeout(() => onDismiss(), delay);
    return () => window.clearTimeout(t);
  }, [id, durationMs, countdownEndsAt, onDismiss, isStackFront, showCountdown, queued]);

  useEffect(() => {
    if (exitMode !== 'cancel' || crumbleStartedRef.current) return;
    crumbleStartedRef.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / CRUMBLE_DURATION_MS, 1);
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
    setExitMode('cancel');
    try {
      await onCancel();
    } catch (e) {
      setError(getUserErrorMessage(e, 'Could not cancel this notification.'));
      setExitMode('expire');
      crumbleStartedRef.current = false;
      setCancelling(false);
    }
  };

  const backdropBlur =
    stackDepth > 0
      ? `blur(${Math.min(16 + stackDepth * 8, 36)}px) saturate(112%)`
      : theme.shell.backdropFilter;

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
        initial={isStackFront ? 'enter' : false}
        animate="visible"
        exit={exitMode}
        variants={variants}
        style={{
          ...theme.shell,
          backdropFilter: backdropBlur,
          WebkitBackdropFilter: backdropBlur,
          filter: exitMode === 'cancel' ? `url(#${filterId})` : undefined,
          willChange: 'transform, opacity, filter',
          pointerEvents: isStackFront ? 'auto' : 'none',
        }}
        className="group relative w-full overflow-hidden rounded-xl transition-[box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
          style={{ background: theme.tint }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/12 to-transparent" />
        {queued ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[3px] items-center justify-center bg-black/25"
            aria-hidden
          >
            <div className={`h-full w-full opacity-40 ${theme.countdownBarClass}`} />
          </div>
        ) : null}
        {showCountdown && !queued ? (
          <CountdownBar
            durationMs={durationMs}
            countdownEndsAt={countdownEndsAt}
            fillClassName={theme.countdownBarClass}
          />
        ) : null}
        <div className="relative flex items-center gap-4 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] font-secondary">
              {operation ? (
                <>
                  <span className={theme.operationTextClass}>
                    {actionOperationLabel(operation)}
                  </span>
                  <span className="text-zinc-500/80"> · </span>
                </>
              ) : null}
              <span className="text-zinc-400/90">{category || 'Notification'}</span>
              {queued ? (
                <>
                  <span className="text-zinc-500/80"> · </span>
                  <span className="text-zinc-500/90">Queued</span>
                </>
              ) : null}
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
  fillClassName,
}: {
  durationMs: number;
  countdownEndsAt?: string;
  fillClassName: string;
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
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] overflow-hidden bg-black/20"
      aria-hidden
    >
      <div
        className={`absolute inset-y-0 left-0 ${fillClassName}`}
        style={{
          width: `${progress * 100}%`,
          willChange: 'width',
        }}
      />
    </div>
  );
}
