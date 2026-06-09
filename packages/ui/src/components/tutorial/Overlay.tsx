import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import {
  TutorialProvider,
  useTutorial,
  useTutorialContext,
} from '@dadei/ui/contexts/TutorialContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import {
  backdropBlurForStep,
  isSettingsTutorialStep,
  TUTORIAL_TEST_BANNER_ID,
  TUTORIAL_TEST_BANNER_TITLE,
} from '@dadei/ui/lib/tutorial/constants';
import {
  permissionsForPlatform,
  toTutorialPlatform,
  type PermissionEntry,
} from '@dadei/ui/lib/tutorial/permissionsRegistry';
import { isTutorialClickAllowed } from '@dadei/ui/lib/tutorial/clickGuard';
import { TUTORIAL_MORPH_TRANSITION } from '@dadei/ui/lib/tutorial/motion';
import type { TutorialStep } from '@dadei/ui/types/tutorial.types';
import { cn } from '@dadei/ui/lib/shared/cn';
import Card from './Card';

const BACKDROP_COLOR = 'rgba(0,0,0,0.12)';

function backdropMotionForStep(step: TutorialStep) {
  const blurPx = backdropBlurForStep(step);
  return {
    backgroundColor: BACKDROP_COLOR,
    backdropFilter: blurPx > 0 ? `blur(${blurPx}px)` : 'blur(0px)',
  };
}

function Backdrop({ step }: { step: TutorialStep }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : TUTORIAL_MORPH_TRANSITION;
  const backdropMotion = backdropMotionForStep(step);

  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-[9998] cursor-default pointer-events-none"
      initial={false}
      animate={backdropMotion}
      transition={transition}
      style={{
        WebkitBackdropFilter: backdropMotion.backdropFilter,
      }}
    />
  );
}

type PermissionUiStatus = 'idle' | 'pending' | 'granted' | 'denied';

function PermissionsContent({
  onAllPermissionsGranted,
}: {
  onAllPermissionsGranted: () => void;
}) {
  const { isElectron, platform } = useSystem();
  const tutorialPlatform = toTutorialPlatform(platform, isElectron);
  const entries = useMemo(
    () => permissionsForPlatform(tutorialPlatform, isElectron),
    [tutorialPlatform, isElectron],
  );
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

  const completedRef = useRef(false);

  useEffect(() => {
    if (!allGranted || completedRef.current) return;
    completedRef.current = true;
    onAllPermissionsGranted();
  }, [allGranted, onAllPermissionsGranted]);

  const handleAllow = useCallback(
    async (entry: PermissionEntry) => {
      setStatusById(prev => ({ ...prev, [entry.id]: 'pending' }));
      await entry.request();
      const recheck = await entry.check();
      const granted = recheck === 'granted';
      setStatusById(prev => {
        const next: Record<string, PermissionUiStatus> = {
          ...prev,
          [entry.id]: granted ? 'granted' : 'denied',
        };
        const nowAllGranted = entries.every(e => next[e.id] === 'granted');
        if (nowAllGranted && !completedRef.current) {
          completedRef.current = true;
          queueMicrotask(() => onAllPermissionsGranted());
        }
        return next;
      });
    },
    [entries, onAllPermissionsGranted],
  );

  const grantedCount = entries.filter(entry => statusById[entry.id] === 'granted').length;

  return (
    <div className="max-h-[min(70vh,28rem)] overflow-y-auto [scrollbar-width:thin]">
      <p className="mt-2 text-sm text-zinc-400 font-secondary">
        Allow each permission below. When everything is allowed, the tour continues automatically.
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

function ClickGuard({ step }: { step: TutorialStep }) {
  useEffect(() => {
    const block = (event: Event) => {
      if (isTutorialClickAllowed(event.target, step)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('pointerdown', block, true);
    document.addEventListener('click', block, true);
    return () => {
      document.removeEventListener('pointerdown', block, true);
      document.removeEventListener('click', block, true);
    };
  }, [step]);

  return null;
}

function OverlayInner() {
  const {
    step,
    next,
    back,
    acknowledgePermissions,
    markActionFired,
    isCurrentStepActionComplete,
    currentStepIndex,
    isActive,
    finishTutorial,
    persistTutorialCompletion,
    markTutorialCompletedClient,
  } = useTutorial();
  const { beginIntroduction } = useCommand();
  const { showToast } = useNotifications();
  const [finishing, setFinishing] = useState(false);
  const canBack = currentStepIndex > 0 && !step.startsIntroduction && !finishing;
  const canNext =
    finishing
      ? false
      : step.actionTriggers?.length
        ? isCurrentStepActionComplete
        : true;

  const handleAllPermissionsGranted = useCallback(() => {
    acknowledgePermissions();
    markActionFired('permission-resolved');
  }, [acknowledgePermissions, markActionFired]);

  const handleNext = useCallback(() => {
    if (step.startsIntroduction) {
      setFinishing(true);
      finishTutorial();
      // Tear down all tutorial UI immediately so nothing blocks settings, persons, etc.
      markTutorialCompletedClient();
      void (async () => {
        try {
          await persistTutorialCompletion();
          const started = await beginIntroduction();
          if (!started) {
            showToast('Could not start introduction. Try again.', 'error');
          }
        } catch (error) {
          console.error('Failed to complete tutorial before introduction:', error);
          showToast('Could not finish setup. Try again.', 'error');
        }
      })();
      return;
    }
    next();
  }, [
    step.startsIntroduction,
    finishTutorial,
    beginIntroduction,
    persistTutorialCompletion,
    markTutorialCompletedClient,
    next,
    showToast,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && canNext && !step.startsIntroduction) {
        e.preventDefault();
        handleNext();
      }
      if (e.key === 'ArrowLeft' && canBack) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canNext, canBack, handleNext, back, step.startsIntroduction]);

  if (!isActive || isSettingsTutorialStep(step.id)) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <ClickGuard step={step} />
      <Backdrop step={step} />
      <Card
        step={step}
        canBack={canBack}
        canNext={canNext}
        onBack={back}
        onNext={handleNext}
      >
        {step.id === 'permissions' ? (
          <PermissionsContent onAllPermissionsGranted={handleAllPermissionsGranted} />
        ) : null}
      </Card>
    </div>
  );
}

function NotificationsBridge() {
  const ctx = useTutorialContext();
  const { showBanner, dismissBanner } = useNotifications();
  const bannerIdRef = useRef<string | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const dismissRef = useRef(dismissBanner);
  dismissRef.current = dismissBanner;

  useEffect(() => {
    const show = ctx?.showTestNotifications ?? false;
    if (!show) {
      if (bannerIdRef.current) {
        dismissRef.current(bannerIdRef.current);
        bannerIdRef.current = null;
      }
      return;
    }
    if (bannerIdRef.current) return;

    const bannerId = showBanner({
      id: TUTORIAL_TEST_BANNER_ID,
      operation: 'delete',
      category: 'Tutorial',
      title: TUTORIAL_TEST_BANNER_TITLE,
      body: 'Wait for the countdown to delete the test conversation, or click Cancel and delete it from the panel.',
      showCountdown: true,
      durationMs: 15_000,
      countdownEndsAt: new Date(Date.now() + 15_000).toISOString(),
      cancelLabel: 'Cancel',
      onCancel: () => {
        // Corrosion + removal handled by Banner; keep bannerIdRef so we don't respawn mid-step.
      },
      onAutoDismiss: () => {
        ctxRef.current?.removeTutorialConversation();
      },
    });
    bannerIdRef.current = bannerId;
  }, [ctx?.showTestNotifications, showBanner]);

  useEffect(
    () => () => {
      if (bannerIdRef.current) {
        dismissRef.current(bannerIdRef.current);
      }
    },
    [],
  );

  return null;
}

/** Overlay UI only — wrap with `TutorialProvider` at the layout root. */
export function TutorialOverlayContent() {
  return (
    <>
      <NotificationsBridge />
      <OverlayInner />
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
