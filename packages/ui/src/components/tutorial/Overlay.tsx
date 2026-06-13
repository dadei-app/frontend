import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
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
} from '@dadei/ui/lib/onboarding/tutorial/constants';
import {
  TUTORIAL_INTERACTION_COUNT,
  TUTORIAL_TEST_CONVERSATION_ID,
} from '@dadei/ui/lib/onboarding/tutorial/fixtures';
import { actionDomainLabel } from '@dadei/ui/lib/workspace/display/actionDisplay';
import { isTutorialClickAllowed } from '@dadei/ui/lib/onboarding/tutorial/clickGuard';
import { TUTORIAL_MORPH_TRANSITION } from '@dadei/ui/lib/onboarding/tutorial/motion';
import type { TutorialStep } from '@dadei/ui/types/tutorial.types';
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

  const handleNext = useCallback(() => {
    if (step.startsIntroduction) {
      setFinishing(true);
      finishTutorial();
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
      />
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
      actionType: 'conversation',
      category: actionDomainLabel('conversation'),
      title: 'Getting started with dadei',
      toolArgs: {
        conversation_id: TUTORIAL_TEST_CONVERSATION_ID,
        topic_summary: 'Getting started with dadei',
        interaction_count: TUTORIAL_INTERACTION_COUNT,
      },
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
