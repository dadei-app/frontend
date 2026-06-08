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
  onAutoDismiss?: () => Promise<void> | void;
  onDismiss: () => void;
  /** Active (top z-order) card — interactive with countdown when enabled. */
  isStackFront?: boolean;
  stackDepth?: number;
  queued?: boolean;
  /** When false, countdown bar stays hidden (e.g. waiting for prior exit). */
  countdownEnabled?: boolean;
  /** Called when crumble or expire-fade exit begins. */
  onExitStart?: () => void;
  /** Called after exit animation fully completes. */
  onExitComplete?: () => void;
}

const ENTER_EASE = [0.16, 1, 0.3, 1] as const;
const CRUMBLE_EASE = [0.7, 0, 0.84, 0] as const;
const CRUMBLE_DURATION_MS = 520;
const EXPIRE_FADE_DURATION_MS = 620;
const COUNTDOWN_SLIDE_MS = 0.38;

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
  onAutoDismiss,
  onDismiss,
  isStackFront = true,
  stackDepth = 0,
  queued = false,
  countdownEnabled = true,
  onExitStart,
  onExitComplete,
}: BannerProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitMode, setExitMode] = useState<'idle' | 'cancel' | 'expire-fade'>('idle');
  const [contentVisible, setContentVisible] = useState(true);
  const [fadeToSolid, setFadeToSolid] = useState(false);

  const theme = operation ? OPERATION_BANNER_THEME[operation] : NEUTRAL_BANNER_THEME;
  const buried = !isStackFront && stackDepth > 0;

  const rawId = useId();
  const filterId = `dadei-crumble-${rawId.replace(/:/g, '')}`;
  const displaceRef = useRef<SVGFEDisplacementMapElement>(null);
  const crumbleStartedRef = useRef(false);
  const expiryStartedRef = useRef(false);
  const exitReportedRef = useRef(false);

  useEffect(() => {
    expiryStartedRef.current = false;
    exitReportedRef.current = false;
    setExitMode('idle');
    setContentVisible(true);
    setFadeToSolid(false);
  }, [id]);

  const reportExitComplete = () => {
    if (exitReportedRef.current) return;
    exitReportedRef.current = true;
    onExitComplete?.();
  };

  const beginExpireFade = () => {
    if (expiryStartedRef.current || exitMode !== 'idle') return;
    expiryStartedRef.current = true;
    onExitStart?.();
    setContentVisible(false);
    setExitMode('expire-fade');
    window.setTimeout(() => setFadeToSolid(true), EXPIRE_FADE_DURATION_MS * 0.35);
    window.setTimeout(() => {
      void onAutoDismiss?.();
      if (!id.startsWith('action:')) {
        onDismiss();
      }
      reportExitComplete();
    }, EXPIRE_FADE_DURATION_MS);
  };

  useEffect(() => {
    if (!isStackFront || !showCountdown || queued || !countdownEnabled || exitMode !== 'idle') {
      return;
    }

    const now = Date.now();
    const end = countdownEndsAt ? parseApiDateTimeMs(countdownEndsAt) : now + durationMs;
    const delay = Math.max(end - now, 0);
    const t = window.setTimeout(beginExpireFade, delay);
    return () => window.clearTimeout(t);
  }, [
    id,
    durationMs,
    countdownEndsAt,
    isStackFront,
    showCountdown,
    queued,
    countdownEnabled,
    exitMode,
  ]);

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
    const done = window.setTimeout(() => reportExitComplete(), CRUMBLE_DURATION_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [exitMode]);

  const handleCancel = async () => {
    if (!onCancel || cancelling || exitMode !== 'idle') return;
    setCancelling(true);
    setError(null);
    onExitStart?.();
    setExitMode('cancel');
    try {
      await onCancel();
      if (!id.startsWith('action:')) {
        onDismiss();
      }
    } catch (e) {
      setError(getUserErrorMessage(e, 'Could not cancel this notification.'));
      setExitMode('idle');
      crumbleStartedRef.current = false;
      setCancelling(false);
    }
  };

  const shellStyle =
    fadeToSolid && exitMode === 'expire-fade'
      ? {
          background: theme.shell.background,
          border: theme.shell.border,
          boxShadow: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        }
      : theme.shell;

  const isExiting = exitMode !== 'idle';
  const cardOpacity = exitMode === 'expire-fade' ? (fadeToSolid ? 0.35 : 1) : 1;

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
        data-tutorial-target={id}
        animate={{
          opacity: cardOpacity,
          scale: exitMode === 'cancel' ? 0.92 : 1,
          filter: exitMode === 'cancel' ? `url(#${filterId})` : 'none',
        }}
        transition={{
          opacity: { duration: EXPIRE_FADE_DURATION_MS / 1000, ease: 'easeOut' },
          scale: { duration: CRUMBLE_DURATION_MS / 1000, ease: CRUMBLE_EASE },
        }}
        style={{
          ...shellStyle,
          backdropFilter: theme.shell.backdropFilter,
          WebkitBackdropFilter: theme.shell.backdropFilter,
          willChange: 'transform, opacity, filter',
          pointerEvents: isStackFront && !isExiting ? 'auto' : 'none',
        }}
        className="group relative w-full overflow-hidden rounded-xl"
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl transition-opacity duration-500"
          style={{
            background: theme.tint,
            opacity: fadeToSolid ? 0 : 1,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/12 to-transparent transition-opacity duration-500"
          style={{ opacity: fadeToSolid ? 0 : 1 }}
        />

        {showCountdown && !queued && countdownEnabled ? (
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
            </p>
            {!buried && contentVisible ? (
              <>
                <motion.p
                  className="mt-1 truncate text-sm font-semibold leading-snug text-zinc-100"
                  animate={{ opacity: exitMode === 'expire-fade' ? 0 : 1 }}
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                >
                  {title}
                </motion.p>
                {body ? (
                  <motion.p
                    className="mt-0.5 truncate text-xs leading-relaxed text-zinc-400 font-secondary"
                    animate={{ opacity: exitMode === 'expire-fade' ? 0 : 1 }}
                    transition={{ duration: 0.42, ease: 'easeOut' }}
                  >
                    {body}
                  </motion.p>
                ) : null}
                {error ? (
                  <p className="mt-1 text-xs text-red-400/90 font-secondary">{error}</p>
                ) : null}
              </>
            ) : null}
          </div>
          {!buried && contentVisible && isStackFront ? (
            onCancel ? (
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling || isExiting}
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
            )
          ) : null}
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
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] overflow-hidden bg-black/20"
      aria-hidden
      initial={{ y: '-100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: COUNTDOWN_SLIDE_MS, ease: ENTER_EASE }}
    >
      <div
        className={`absolute inset-y-0 left-0 ${fillClassName}`}
        style={{
          width: `${progress * 100}%`,
          willChange: 'width',
        }}
      />
    </motion.div>
  );
}
