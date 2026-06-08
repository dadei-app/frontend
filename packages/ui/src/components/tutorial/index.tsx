import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { cn } from '@dadei/ui/lib/shared/cn';
import {
  TUTORIAL_PLATFORM,
  TUTORIAL_TEST_BANNER_ID,
  TUTORIAL_TEST_BANNER_TITLE,
  TUTORIAL_TEST_TOAST_MESSAGE,
} from './constants';
import { permissionsForPlatform, type PermissionEntry } from './permissionsRegistry';
import TutorialCard from './TutorialCard';
import ArrowLayer from './ArrowLayer';
import { TutorialProvider, useTutorialContext } from './TutorialContext';
import { TUTORIAL_MORPH_TRANSITION } from './tutorialMotion';
import { useTutorial } from './useTutorial';
import type { TutorialStep } from './types';

const SPOTLIGHT_BACKDROP = { backgroundColor: 'rgba(0,0,0,0.12)', backdropFilter: 'blur(12px)' };
const ACTION_BACKDROP = { backgroundColor: 'rgba(0,0,0,0.02)', backdropFilter: 'blur(0px)' };
const ACTION_BACKDROP_FILL = 'rgba(0,0,0,0.02)';

function useTargetRect(targetKey: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetKey) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-tutorial-target="${targetKey}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    const el = document.querySelector(`[data-tutorial-target="${targetKey}"]`);
    if (el) ro.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [targetKey]);

  return rect;
}

function Backdrop({ step }: { step: TutorialStep }) {
  const reduceMotion = useReducedMotion();
  const rect = useTargetRect(step.kind === 'action' ? step.targetKey : null);
  const transition = reduceMotion ? { duration: 0 } : TUTORIAL_MORPH_TRANSITION;
  const isSpotlight = step.kind === 'spotlight';
  const showActionCutout = step.kind === 'action' && rect !== null;

  const pad = 8;
  const cutout = rect
    ? {
        x: Math.max(0, rect.left - pad),
        y: Math.max(0, rect.top - pad),
        w: rect.width + pad * 2,
        h: rect.height + pad * 2,
      }
    : null;

  return (
    <>
      <motion.div
        aria-hidden
        className="fixed inset-0 z-[9998] cursor-default pointer-events-none"
        initial={false}
        animate={isSpotlight ? SPOTLIGHT_BACKDROP : ACTION_BACKDROP}
        transition={transition}
        style={{
          WebkitBackdropFilter: isSpotlight ? SPOTLIGHT_BACKDROP.backdropFilter : ACTION_BACKDROP.backdropFilter,
        }}
      />
      {cutout ? (
        <motion.svg
          className="fixed inset-0 z-[9999] h-full w-full cursor-default pointer-events-none"
          aria-hidden
          initial={false}
          animate={{ opacity: showActionCutout ? 1 : 0 }}
          transition={transition}
        >
          <defs>
            <mask id="tutorial-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={cutout.x} y={cutout.y} width={cutout.w} height={cutout.h} rx={12} fill="black" />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill={ACTION_BACKDROP_FILL}
            mask="url(#tutorial-spotlight-mask)"
          />
        </motion.svg>
      ) : null}
    </>
  );
}

type PermissionUiStatus = 'idle' | 'pending' | 'granted' | 'denied';

function PermissionsContent({
  onPermissionsReady,
  onAdvanceAfterGrant,
}: {
  onPermissionsReady: () => void;
  onAdvanceAfterGrant: () => void;
}) {
  const entries = permissionsForPlatform(TUTORIAL_PLATFORM);
  const [statusById, setStatusById] = useState<Record<string, PermissionUiStatus>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, PermissionUiStatus> = {};
      await Promise.all(
        entries.map(async entry => {
          const result = await entry.check();
          if (result === 'granted') next[entry.id] = 'granted';
          else if (result === 'denied') next[entry.id] = 'denied';
        }),
      );
      if (!cancelled) {
        setStatusById(prev => ({ ...next, ...prev }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const allGranted =
    entries.length === 0 || entries.every(entry => statusById[entry.id] === 'granted');

  useEffect(() => {
    if (allGranted) onPermissionsReady();
  }, [allGranted, onPermissionsReady]);

  const handleAllow = useCallback(
    async (entry: PermissionEntry) => {
      const wasAllGranted = entries.every(e => statusById[e.id] === 'granted');
      setStatusById(prev => ({ ...prev, [entry.id]: 'pending' }));
      await entry.request();
      const recheck = await entry.check();
      const granted = recheck === 'granted';
      setStatusById(prev => ({
        ...prev,
        [entry.id]: granted ? 'granted' : 'denied',
      }));
      if (!wasAllGranted && granted) {
        const nowAllGranted = entries.every(
          e => e.id === entry.id || statusById[e.id] === 'granted',
        );
        if (nowAllGranted) onAdvanceAfterGrant();
      }
    },
    [entries, statusById, onAdvanceAfterGrant],
  );

  const grantedCount = entries.filter(entry => statusById[entry.id] === 'granted').length;

  return (
    <div className="max-h-[min(70vh,28rem)] overflow-y-auto [scrollbar-width:thin]">
      <p className="mt-2 text-sm text-zinc-400 font-secondary">
        Allow each permission below. When everything is allowed, use the forward arrow to continue.
      </p>
      {entries.length > 0 ? (
        <p className="mt-1 text-xs text-zinc-600 font-secondary">
          {grantedCount} of {entries.length} allowed
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {entries.map(entry => {
          const status = statusById[entry.id] ?? 'idle';
          const label =
            status === 'pending' ? '…' : status === 'granted' ? 'Allowed' : 'Allow';

          return (
            <li
              key={entry.id}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-zinc-100">{entry.label}</p>
                <p className="text-xs text-zinc-500 font-secondary">{entry.description}</p>
              </div>
              <button
                type="button"
                disabled={status === 'pending' || status === 'granted'}
                className={cn(
                  'shrink-0 min-w-[5.5rem] rounded-lg border px-3 py-1.5 text-sm transition',
                  status === 'granted' &&
                    'cursor-default border-white/8 bg-zinc-800/80 text-zinc-500',
                  status === 'pending' &&
                    'cursor-wait border-white/10 bg-zinc-800/60 text-zinc-500',
                  (status === 'idle' || status === 'denied') &&
                    'border-emerald-500/30 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50',
                )}
                onClick={() => {
                  void handleAllow(entry);
                }}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TutorialOverlayInner() {
  const cardRef = useRef<HTMLDivElement>(null);
  const {
    step,
    next,
    back,
    acknowledgePermissions,
    permissionsResolved,
    isCurrentStepActionComplete,
    currentStepIndex,
    showTestNotifications,
    wakeHintVisible,
  } = useTutorial();
  const canBack = currentStepIndex > 0;
  const canNext =
    step.id === 'permissions'
      ? permissionsResolved
      : step.kind === 'spotlight'
        ? true
        : step.actionTrigger
          ? isCurrentStepActionComplete
          : false;
  const [wakeHintShown, setWakeHintShown] = useState(false);

  useEffect(() => {
    if (!wakeHintVisible) {
      setWakeHintShown(false);
      return;
    }
    const t = window.setTimeout(() => setWakeHintShown(true), 60_000);
    return () => window.clearTimeout(t);
  }, [wakeHintVisible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && canNext) {
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canNext, next, back]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <Backdrop step={step} />
      <ArrowLayer step={step} cardRef={cardRef} />
      <TutorialCard
        step={step}
        showWakeHint={wakeHintVisible && wakeHintShown}
        canBack={canBack}
        canNext={canNext}
        onBack={back}
        onNext={next}
      >
        {step.id === 'permissions' ? (
          <PermissionsContent
            onPermissionsReady={acknowledgePermissions}
            onAdvanceAfterGrant={acknowledgePermissions}
          />
        ) : null}
      </TutorialCard>
    </div>
  );
}

/** Fires layout-tour toast/banner when that step is active. */
export function TutorialNotificationsBridge() {
  const ctx = useTutorialContext();
  const { showToast, showBanner, dismissBanner, toasts, banners } = useNotifications();

  useEffect(() => {
    if (!ctx?.showTestNotifications) return;
    showToast(TUTORIAL_TEST_TOAST_MESSAGE, 'info');
    const bannerId = showBanner({
      id: TUTORIAL_TEST_BANNER_ID,
      operation: 'delete',
      category: 'Tutorial',
      title: TUTORIAL_TEST_BANNER_TITLE,
      body: 'Cancel to keep the conversation, or wait for the countdown to delete it.',
      showCountdown: true,
      durationMs: 15_000,
      cancelLabel: 'Cancel',
      onCancel: () => {
        dismissBanner(bannerId);
      },
      onAutoDismiss: () => {
        ctx.removeTutorialConversation();
      },
    });
    return () => dismissBanner(bannerId);
  }, [ctx?.showTestNotifications, ctx, showToast, showBanner, dismissBanner]);

  useEffect(() => {
    if (!ctx?.showTestNotifications || ctx.step.actionTrigger !== 'notifications-dismissed') return;
    const toastGone = !toasts.some(t => t.message === TUTORIAL_TEST_TOAST_MESSAGE);
    const bannerGone = !banners.some(b => b.id === TUTORIAL_TEST_BANNER_ID);
    if (toastGone && bannerGone) {
      ctx.markActionFired('notifications-dismissed');
    }
  }, [ctx, toasts, banners]);

  return null;
}

/** Overlay UI only — wrap with `TutorialProvider` at the layout root. */
export function TutorialOverlayContent() {
  return (
    <>
      <TutorialNotificationsBridge />
      <TutorialOverlayInner />
    </>
  );
}

export function TutorialOverlay() {
  return (
    <TutorialProvider>
      <TutorialOverlayContent />
    </TutorialProvider>
  );
}

export { TutorialProvider } from './useTutorial';
