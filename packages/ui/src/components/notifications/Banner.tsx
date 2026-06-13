import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { parseApiDateTimeMs } from '@dadei/ui/lib/platform/shared/parseApiDateTime';
import type { ActionOperation } from '@dadei/ui/types/models.types';
import { getUserErrorMessage } from '@dadei/ui/lib/platform/errors/userMessage';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import {
  CalendarEventBody,
  ConversationDeleteBody,
  EmailBody,
  InteractionDeleteBody,
  PersonDeleteBody,
} from '@dadei/ui/components/notifications/bodies';
import {
  BANNER_COLLAPSED_HEIGHT_PX,
  BANNER_EXPANDED_MAX_HEIGHT_PX,
} from '@dadei/ui/lib/assistant/notifications/bannerStack';
import {
  actionOperationLabel,
  NEUTRAL_BANNER_THEME,
  OPERATION_BANNER_THEME,
} from '@dadei/ui/lib/workspace/display/actionDisplay';

const BANNER_BODY_SCROLL_CLASS =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgba(161,161,170,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/45';

export type BannerExitMode = 'slide-up' | 'acid';

export interface BannerProps {
  id: string;
  category?: string;
  operation?: ActionOperation;
  actionType?: string;
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
  durationMs: number;
  showCountdown?: boolean;
  countdownEndsAt?: string;
  cancelLabel?: string;
  onCancel?: () => Promise<void> | void;
  onAutoDismiss?: () => Promise<void> | void;
  onDismiss: () => void;
  isStackFront?: boolean;
  stackDepth?: number;
  queued?: boolean;
  countdownEnabled?: boolean;
  onExitStart?: (mode: BannerExitMode) => void;
  onExitComplete?: () => void;
}

const EXPAND_EASE = [0.16, 1, 0.3, 1] as const;
const EXPAND_TRANSITION = { duration: 0.34, ease: EXPAND_EASE } as const;
const EXIT_SETTLE_MS = 650;
const ACID_DISSOLVE_DURATION_MS = 1800;
const COUNTDOWN_REVEAL_MS = 0.38;
/** Time-reversed counterpart of COUNTDOWN_REVEAL_EASE — mirrors the reveal curve. */
const COUNTDOWN_REVEAL_EASE = [0.16, 1, 0.3, 1] as const;
const COUNTDOWN_RETRACT_EASE = [0.7, 0, 0.84, 0] as const;
const COUNTDOWN_REVEAL_TRANSITION = {
  duration: COUNTDOWN_REVEAL_MS,
  ease: COUNTDOWN_REVEAL_EASE,
} as const;
const COUNTDOWN_RETRACT_TRANSITION = {
  duration: COUNTDOWN_REVEAL_MS,
  ease: COUNTDOWN_RETRACT_EASE,
} as const;
const ACID_SPOT_COUNT = 2;

type LocalExitMode = 'idle' | 'expire' | 'cancel';

type AcidSpot = {
  cx: number;
  cy: number;
  seed: number;
  rx: number;
  ry: number;
  edgeSoftness: number;
  phase: number;
};

function seedAcidSpots(key: string): AcidSpot[] {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const rnd = () => {
    hash = Math.imul(hash ^ (hash >>> 15), hash | 1);
    hash ^= hash + Math.imul(hash ^ (hash >>> 7), hash | 61);
    return ((hash ^ (hash >>> 14)) >>> 0) / 4294967296;
  };

  const corners = [
    { cx: 0.06 + rnd() * 0.28, cy: 0.08 + rnd() * 0.28 },
    { cx: 0.62 + rnd() * 0.3, cy: 0.52 + rnd() * 0.38 },
  ];

  return corners.map((corner, index) => ({
    ...corner,
    seed: 1 + Math.floor(rnd() * 997),
    rx: 0.72 + rnd() * 0.55,
    ry: 0.68 + rnd() * 0.62,
    edgeSoftness: 14 + rnd() * 22,
    phase: rnd() * 0.12 + index * 0.04,
  }));
}

function fractalNoiseMaskUri(seed: number, frequency: number): string {
  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
      `<filter id="f" x="0%" y="0%" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${frequency.toFixed(3)}" numOctaves="5" seed="${seed}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>` +
      `</filter>` +
      `<rect width="100%" height="100%" filter="url(#f)" fill="white"/>` +
      `</svg>`,
  )}")`;
}

function buildDissolveMask(
  spots: AcidSpot[],
  active: number,
  noiseSeed: number,
): { image: string; layers: number } {
  const spotLayers = spots.map((spot) => {
    const spotProgress =
      active <= spot.phase ? 0 : Math.min(1, (active - spot.phase) / (1 - spot.phase));
    const eased = spotProgress * spotProgress * (3 - 2 * spotProgress);
    if (eased <= 0.001) {
      return 'linear-gradient(black, black)';
    }
    const radius = eased * 58;
    const edge = Math.min(radius + spot.edgeSoftness, 100);
    const rx = (spot.rx * 100).toFixed(1);
    const ry = (spot.ry * 100).toFixed(1);
    return `radial-gradient(ellipse ${rx}% ${ry}% at ${(spot.cx * 100).toFixed(1)}% ${(spot.cy * 100).toFixed(1)}%, transparent ${radius.toFixed(1)}%, black ${edge.toFixed(1)}%)`;
  });

  if (active <= 0.02) {
    return { image: spotLayers.join(', '), layers: spotLayers.length };
  }

  const noiseFrequency = 0.48 + active * 0.38;
  return {
    image: `${spotLayers.join(', ')}, ${fractalNoiseMaskUri(noiseSeed, noiseFrequency)}`,
    layers: spotLayers.length + 1,
  };
}

function maskLayerStyle(layerCount: number, hasNoise: boolean): Pick<
  CSSProperties,
  'WebkitMaskSize' | 'maskSize' | 'WebkitMaskRepeat' | 'maskRepeat' | 'WebkitMaskComposite' | 'maskComposite'
> {
  if (layerCount <= 0) return {};

  const sizes = Array.from({ length: layerCount }, (_, index) =>
    hasNoise && index === layerCount - 1 ? '220% 220%' : '100% 100%',
  );
  const repeats = Array.from({ length: layerCount }, (_, index) =>
    hasNoise && index === layerCount - 1 ? 'repeat' : 'no-repeat',
  );

  const base = {
    WebkitMaskSize: sizes.join(', '),
    maskSize: sizes.join(', '),
    WebkitMaskRepeat: repeats.join(', '),
    maskRepeat: repeats.join(', '),
  };

  if (layerCount === 1) return base;

  return {
    ...base,
    WebkitMaskComposite: Array(layerCount - 1).fill('source-in').join(', '),
    maskComposite: Array(layerCount - 1).fill('intersect').join(', '),
  };
}

function dissolveActive(progress: number): number {
  return progress * progress * progress;
}

function DefaultBannerContent({
  title,
  body,
  compact,
}: {
  title: string;
  body?: string;
  compact: boolean;
}) {
  return (
    <>
      <p
        className={cn(
          'text-sm font-semibold leading-snug text-zinc-100',
          compact ? 'mt-0.5 truncate' : 'mt-1',
        )}
      >
        {title}
      </p>
      {body && !compact ? (
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400 font-secondary">{body}</p>
      ) : null}
    </>
  );
}

function BannerContent({
  actionType,
  operation,
  title,
  body,
  toolArgs,
  startTime,
  endTime,
  compact,
}: {
  actionType?: string;
  operation?: ActionOperation;
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
  compact: boolean;
}) {
  const kind = (actionType ?? 'notification').toLowerCase();

  if (kind === 'conversation' && operation === 'delete') {
    return (
      <ConversationDeleteBody title={title} body={body} toolArgs={toolArgs} compact={compact} />
    );
  }

  if (kind === 'interaction' && operation === 'delete') {
    return (
      <InteractionDeleteBody title={title} body={body} toolArgs={toolArgs} compact={compact} />
    );
  }

  if (kind === 'person' && operation === 'delete') {
    return <PersonDeleteBody title={title} body={body} toolArgs={toolArgs} compact={compact} />;
  }

  if (kind === 'email') {
    return <EmailBody toolArgs={toolArgs} title={title} />;
  }

  if (kind === 'calendar') {
    return (
      <CalendarEventBody
        title={title}
        body={body}
        toolArgs={toolArgs}
        startTime={startTime}
        endTime={endTime}
        operation={operation}
      />
    );
  }

  return <DefaultBannerContent title={title} body={body} compact={compact} />;
}

export default function Banner({
  id,
  category,
  operation,
  actionType,
  title,
  body,
  toolArgs,
  startTime,
  endTime,
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
  const [exitMode, setExitMode] = useState<LocalExitMode>('idle');
  const [dissolveMask, setDissolveMask] = useState<{ image: string; layers: number } | null>(null);
  const isExiting = exitMode !== 'idle';

  const theme = operation ? OPERATION_BANNER_THEME[operation] : NEUTRAL_BANNER_THEME;
  const showActions = isStackFront && !isExiting;
  const isExpanded = isStackFront && !queued;
  const acidSpots = useMemo(() => seedAcidSpots(id), [id]);
  const noiseSeed = acidSpots[0]?.seed ?? 7;

  const expiryStartedRef = useRef(false);
  const acidStartedRef = useRef(false);
  const exitReportedRef = useRef(false);
  const exitReasonRef = useRef<'expire' | 'cancel' | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const acidRafRef = useRef(0);

  useEffect(() => {
    expiryStartedRef.current = false;
    acidStartedRef.current = false;
    exitReportedRef.current = false;
    exitReasonRef.current = null;
    setExitMode('idle');
    setDissolveMask(null);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    if (acidRafRef.current) cancelAnimationFrame(acidRafRef.current);
  }, [id]);

  const reportExitComplete = useCallback(() => {
    if (exitReportedRef.current) return;
    exitReportedRef.current = true;
    onExitComplete?.();
  }, [onExitComplete]);

  const finishExit = useCallback(() => {
    if (exitReasonRef.current === 'expire') {
      void onAutoDismiss?.();
    }
    if (!id.startsWith('action:')) {
      onDismiss();
    }
    reportExitComplete();
  }, [id, onAutoDismiss, onDismiss, reportExitComplete]);

  const beginExpire = useCallback(() => {
    if (expiryStartedRef.current) return;
    expiryStartedRef.current = true;
    exitReasonRef.current = 'expire';
    onExitStart?.('slide-up');
    setExitMode('expire');
    exitTimerRef.current = window.setTimeout(finishExit, EXIT_SETTLE_MS);
  }, [finishExit, onExitStart]);

  const runAcidDissolve = useCallback(() => {
    if (acidStartedRef.current) return;
    acidStartedRef.current = true;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / ACID_DISSOLVE_DURATION_MS, 1);
      const active = dissolveActive(progress);
      setDissolveMask(buildDissolveMask(acidSpots, active, noiseSeed));
      if (progress < 1) {
        acidRafRef.current = requestAnimationFrame(tick);
      }
    };
    acidRafRef.current = requestAnimationFrame(tick);
    exitTimerRef.current = window.setTimeout(finishExit, ACID_DISSOLVE_DURATION_MS);
  }, [acidSpots, finishExit, noiseSeed]);

  useEffect(() => {
    if (showCountdown || !isStackFront || queued || !countdownEnabled || exitMode !== 'idle') {
      return;
    }

    const now = Date.now();
    const end = countdownEndsAt ? parseApiDateTimeMs(countdownEndsAt) : now + durationMs;
    const delay = Math.max(end - now, 0);
    const t = window.setTimeout(beginExpire, delay);
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
    beginExpire,
  ]);

  const handleCancel = () => {
    if (!onCancel || cancelling || exitMode !== 'idle') return;
    expiryStartedRef.current = true;
    exitReasonRef.current = 'cancel';
    setCancelling(true);
    setError(null);
    onExitStart?.('acid');
    flushSync(() => {
      setExitMode('cancel');
      setDissolveMask(buildDissolveMask(acidSpots, 0.04, noiseSeed));
    });
    runAcidDissolve();
    void Promise.resolve(onCancel()).catch((e) => {
      setError(getUserErrorMessage(e, 'Could not cancel this notification.'));
      expiryStartedRef.current = false;
      acidStartedRef.current = false;
      exitReasonRef.current = null;
      setExitMode('idle');
      setDissolveMask(null);
      setCancelling(false);
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      if (acidRafRef.current) cancelAnimationFrame(acidRafRef.current);
    });
  };

  const isDissolving = exitMode === 'cancel' && dissolveMask !== null;
  const dissolveMaskStyle = isDissolving
    ? maskLayerStyle(dissolveMask.layers, dissolveMask.layers > ACID_SPOT_COUNT)
    : {};

  return (
    <motion.div
      data-tutorial-target={id}
      layout
      initial={false}
      animate={{
        height: isExpanded ? 'auto' : BANNER_COLLAPSED_HEIGHT_PX,
      }}
      transition={EXPAND_TRANSITION}
      style={{
        ...theme.shell,
        backdropFilter: theme.shell.backdropFilter,
        WebkitBackdropFilter: theme.shell.backdropFilter,
        maxHeight: isExpanded ? BANNER_EXPANDED_MAX_HEIGHT_PX : BANNER_COLLAPSED_HEIGHT_PX,
        willChange: isDissolving ? 'mask-image' : undefined,
        pointerEvents: isStackFront && !isExiting ? 'auto' : 'none',
        WebkitMaskImage: isDissolving ? dissolveMask.image : undefined,
        maskImage: isDissolving ? dissolveMask.image : undefined,
        ...dissolveMaskStyle,
      }}
      className="group relative flex w-full flex-col overflow-hidden rounded-xl"
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
        style={{ background: theme.tint }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/12 to-transparent"
        aria-hidden
      />

      {showCountdown && !queued ? (
        <CountdownBar
          durationMs={durationMs}
          countdownEndsAt={countdownEndsAt}
          fillClassName={theme.countdownBarClass}
          paused={!countdownEnabled && exitMode !== 'cancel'}
          retracting={exitMode === 'cancel'}
          onComplete={beginExpire}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-2.5">
        <div className="flex min-h-0 flex-1 items-start gap-3">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] font-secondary">
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
            <div
              className={cn(
                BANNER_BODY_SCROLL_CLASS,
                !isExpanded && 'overflow-hidden',
              )}
            >
              <BannerContent
                actionType={actionType}
                operation={operation}
                title={title}
                body={body}
                toolArgs={toolArgs}
                startTime={startTime}
                endTime={endTime}
                compact={!isExpanded}
              />
            </div>
            {error ? (
              <p className="mt-1 shrink-0 text-xs text-red-400/90 font-secondary">{error}</p>
            ) : null}
          </div>

          {showActions ? (
            onCancel ? (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition duration-200 hover:bg-white/4 hover:text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
              >
                {cancelling ? 'Cancelling…' : cancelLabel || 'Cancel'}
              </button>
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
      </div>
    </motion.div>
  );
}

function CountdownBar({
  durationMs,
  countdownEndsAt,
  fillClassName,
  paused = false,
  retracting = false,
  onComplete,
}: {
  durationMs: number;
  countdownEndsAt?: string;
  fillClassName: string;
  paused?: boolean;
  retracting?: boolean;
  onComplete?: () => void;
}) {
  const [progress, setProgress] = useState(1);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
  }, [countdownEndsAt, durationMs]);

  useEffect(() => {
    const windowMs = Math.max(durationMs, 1);
    const endMs = countdownEndsAt
      ? parseApiDateTimeMs(countdownEndsAt)
      : Date.now() + windowMs;

    if (!Number.isFinite(endMs)) {
      setProgress(0);
      onComplete?.();
      return;
    }

    let raf = 0;
    const tick = () => {
      if (paused || retracting) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const remainingMs = Math.max(endMs - Date.now(), 0);
      setProgress(Math.min(remainingMs / windowMs, 1));
      if (remainingMs <= 0) {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, [countdownEndsAt, durationMs, onComplete, paused, retracting]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] overflow-hidden bg-black/20"
      aria-hidden
      initial={{ y: '-100%', opacity: 0 }}
      animate={
        retracting
          ? { y: '-100%', opacity: 0 }
          : { y: 0, opacity: 1 }
      }
      transition={
        retracting ? COUNTDOWN_RETRACT_TRANSITION : COUNTDOWN_REVEAL_TRANSITION
      }
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
