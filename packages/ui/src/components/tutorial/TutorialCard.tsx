import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@dadei/ui/lib/shared/cn';
import TutorialStepCardFrame from './TutorialStepCardFrame';
import {
  TUTORIAL_MORPH_MS,
  TUTORIAL_MORPH_TRANSITION,
} from './tutorialMotion';
import type { TutorialStep } from './types';

const KNOB_CLASS =
  'flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 text-zinc-400 shadow-sm transition hover:border-emerald-500/25 hover:bg-zinc-800 hover:text-emerald-200 disabled:pointer-events-none disabled:opacity-30';

const CARD_MARGIN = 16;
const CARD_WIDTH_SM = 384;
const CARD_WIDTH_LG = 512;

const MORPH_MS = TUTORIAL_MORPH_MS;
const MORPH_BOX = TUTORIAL_MORPH_TRANSITION;
/** Text fades out, brief hold, fades in — swap while fully transparent. */
const MORPH_TEXT_OPACITY = [1, 0, 0, 1] as const;
const MORPH_TEXT_TIMES = [0, 0.32, 0.4, 1] as const;
const MORPH_TEXT_SWAP_AT = 0.36;

type Phase = 'idle' | 'morph';

type BoxSize = { width: number; height: number };
type Point = { top: number; left: number };

export function TutorialCardNav({
  canBack,
  canNext,
  onBack,
  onNext,
}: {
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <nav className="flex shrink-0 gap-1" aria-label="Tutorial navigation">
      <button
        type="button"
        className={KNOB_CLASS}
        aria-label="Previous step"
        disabled={!canBack}
        onClick={onBack}
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className={KNOB_CLASS}
        aria-label="Next step"
        disabled={!canNext}
        onClick={onNext}
      >
        <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
      </button>
    </nav>
  );
}

function cardWidthFor(step: TutorialStep) {
  return step.id === 'permissions' ? CARD_WIDTH_LG : CARD_WIDTH_SM;
}

function centerFromTopLeft(tl: { top: number; left: number }, cardW: number, cardH: number): Point {
  return { top: tl.top + cardH / 2, left: tl.left + cardW / 2 };
}

function clampTopLeft(
  pos: { top: number; left: number },
  cardW: number,
  cardH: number,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    top: Math.max(CARD_MARGIN, Math.min(pos.top, vh - cardH - CARD_MARGIN)),
    left: Math.max(CARD_MARGIN, Math.min(pos.left, vw - cardW - CARD_MARGIN)),
  };
}

function fitsViewport(pos: { top: number; left: number }, cardW: number, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    pos.top >= CARD_MARGIN &&
    pos.left >= CARD_MARGIN &&
    pos.top + cardH <= vh - CARD_MARGIN &&
    pos.left + cardW <= vw - CARD_MARGIN
  );
}

/** Placement candidates tuned for shell vs panel row targets (stable, predictable). */
function placementCandidates(rect: DOMRect, cardW: number, cardH: number) {
  const vw = window.innerWidth;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rowAlignedY = cy - cardH / 2;

  const isShellLike = rect.width >= vw * 0.55 && rect.height >= window.innerHeight * 0.45;
  const isRowLike = rect.height <= 80 && rect.width < vw * 0.55;

  const belowCentered = { top: rect.bottom + CARD_MARGIN, left: cx - cardW / 2 };
  const belowLeft = { top: rect.bottom + CARD_MARGIN, left: rect.left };
  const aboveCentered = { top: rect.top - cardH - CARD_MARGIN, left: cx - cardW / 2 };
  const right = { top: rowAlignedY, left: rect.right + CARD_MARGIN };
  const left = { top: rowAlignedY, left: rect.left - cardW - CARD_MARGIN };

  if (isShellLike) return [belowCentered, aboveCentered, right, left];
  if (isRowLike) return [right, belowLeft, aboveCentered, left, belowCentered];
  return [belowCentered, belowLeft, right, left, aboveCentered];
}

function placementForRect(
  rect: DOMRect,
  cardW: number,
  cardH: number,
  placement: TutorialStep['cardPlacement'] = 'auto',
) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fallback = {
    top: Math.max(CARD_MARGIN, (vh - cardH) / 2),
    left: Math.max(CARD_MARGIN, (vw - cardW) / 2),
  };

  const cx = rect.left + rect.width / 2;
  const rowAlignedY = rect.top + rect.height / 2 - cardH / 2;

  if (placement === 'left') {
    const pos = { top: rowAlignedY, left: rect.left - cardW - CARD_MARGIN };
    if (fitsViewport(pos, cardW, cardH)) return clampTopLeft(pos, cardW, cardH);
  }
  if (placement === 'right') {
    const pos = { top: rowAlignedY, left: rect.right + CARD_MARGIN };
    if (fitsViewport(pos, cardW, cardH)) return clampTopLeft(pos, cardW, cardH);
  }
  if (placement === 'below') {
    const pos = { top: rect.bottom + CARD_MARGIN, left: cx - cardW / 2 };
    if (fitsViewport(pos, cardW, cardH)) return clampTopLeft(pos, cardW, cardH);
  }
  if (placement === 'above') {
    const pos = { top: rect.top - cardH - CARD_MARGIN, left: cx - cardW / 2 };
    if (fitsViewport(pos, cardW, cardH)) return clampTopLeft(pos, cardW, cardH);
  }

  for (const pos of placementCandidates(rect, cardW, cardH)) {
    if (fitsViewport(pos, cardW, cardH)) {
      return clampTopLeft(pos, cardW, cardH);
    }
  }
  return fallback;
}

function topLeftForStep(step: TutorialStep, cardW: number, cardH: number) {
  const anchorKey = step.cardAnchorKey ?? step.targetKey;
  if (!anchorKey) {
    return {
      top: (window.innerHeight - cardH) / 2,
      left: (window.innerWidth - cardW) / 2,
    };
  }
  const target = document.querySelector(`[data-tutorial-target="${anchorKey}"]`);
  if (!target) {
    return {
      top: (window.innerHeight - cardH) / 2,
      left: (window.innerWidth - cardW) / 2,
    };
  }
  return placementForRect(
    target.getBoundingClientRect(),
    cardW,
    cardH,
    step.cardPlacement ?? 'auto',
  );
}

function centerForStep(step: TutorialStep, size: BoxSize): Point {
  const tl = topLeftForStep(step, size.width, size.height);
  return centerFromTopLeft(tl, size.width, size.height);
}

function readBoxSize(el: HTMLElement | null): BoxSize | null {
  if (!el) return null;
  return { width: el.offsetWidth, height: el.offsetHeight };
}

function defaultBoxSize(step: TutorialStep): BoxSize {
  return { width: cardWidthFor(step), height: 200 };
}

function TutorialCardBody({
  step,
  permissionsChildren,
}: {
  step: TutorialStep;
  permissionsChildren?: ReactNode;
}) {
  return (
    <>
      <h2 className="pr-[4.25rem] font-primary text-lg font-semibold leading-tight text-zinc-50">
        {step.title}
      </h2>
      {step.id === 'permissions' ? (
        permissionsChildren
      ) : step.body.trim() ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-300 font-secondary">{step.body}</p>
      ) : null}
    </>
  );
}

function TutorialCardContent({
  step,
  showWakeHint,
  permissionsChildren,
  canBack,
  canNext,
  onBack,
  onNext,
  titleId,
  interactive,
}: {
  step: TutorialStep;
  showWakeHint?: boolean;
  permissionsChildren?: ReactNode;
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  titleId: string;
  interactive: boolean;
}) {
  return (
    <>
      <div
        className={`absolute top-0 right-0 z-20 ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <TutorialCardNav canBack={canBack} canNext={canNext} onBack={onBack} onNext={onNext} />
      </div>
      <h2 id={titleId} className="sr-only">
        {step.title}
      </h2>
      <TutorialCardBody step={step} permissionsChildren={permissionsChildren} />
    </>
  );
}

export default function TutorialCard({
  step,
  showWakeHint,
  canBack,
  canNext,
  onBack,
  onNext,
  children,
}: {
  step: TutorialStep;
  showWakeHint?: boolean;
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const shellRef = useRef<HTMLDivElement>(null);
  const hiddenMeasureRef = useRef<HTMLDivElement>(null);
  const initialSize = defaultBoxSize(step);
  const boxSizeRef = useRef<BoxSize>(initialSize);
  const lastCenterRef = useRef<Point | null>(null);

  const [center, setCenter] = useState<Point>(() => centerForStep(step, initialSize));
  const [ready, setReady] = useState(false);
  const [displayedStep, setDisplayedStep] = useState(step);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [phase, setPhase] = useState<Phase>('idle');
  const [boxSize, setBoxSize] = useState<BoxSize>(initialSize);

  const boxTransition = reduceMotion ? { duration: 0 } : MORPH_BOX;
  const textTransition = reduceMotion
    ? { duration: 0 }
    : {
        duration: MORPH_MS / 1000,
        times: [...MORPH_TEXT_TIMES],
        ease: 'easeInOut' as const,
      };
  const measureStepSize = useCallback(() => readBoxSize(hiddenMeasureRef.current), []);

  const applyLayout = useCallback(
    (targetStep: TutorialStep) => {
      const measured = measureStepSize();
      const size = measured ?? boxSizeRef.current;
      const nextCenter = centerForStep(targetStep, size);
      boxSizeRef.current = size;
      setBoxSize(size);
      setCenter(nextCenter);
      lastCenterRef.current = nextCenter;
      return nextCenter;
    },
    [measureStepSize],
  );

  const startMorph = useCallback(() => {
    const next = step;
    const measured = measureStepSize();
    const size: BoxSize = measured ?? {
      width: cardWidthFor(next),
      height: boxSizeRef.current.height,
    };
    const nextCenter = centerForStep(next, size);

    boxSizeRef.current = size;
    setBoxSize(size);
    setCenter(nextCenter);

    if (reduceMotion) {
      setDisplayedStep(next);
      setDisplayedChildren(next.id === 'permissions' ? children : null);
      lastCenterRef.current = nextCenter;
      setPhase('idle');
      return;
    }

    setPhase('morph');
  }, [step, children, measureStepSize, reduceMotion]);

  useLayoutEffect(() => {
    if (phase !== 'idle') return;
    applyLayout(step);
    setReady(true);
  }, [step, children, phase, showWakeHint, applyLayout]);

  /** Permissions list layout settles after mount — remeasure once without interrupting morph. */
  useLayoutEffect(() => {
    if (phase !== 'idle' || step.id !== 'permissions') return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => applyLayout(step));
    });
    return () => cancelAnimationFrame(id);
  }, [phase, step.id, children, applyLayout, step]);

  useEffect(() => {
    if (step.id === displayedStep.id) {
      if (phase === 'idle') setDisplayedChildren(children);
      return;
    }
    if (phase !== 'idle') return;
    startMorph();
  }, [step.id, displayedStep.id, phase, children, startMorph]);

  useEffect(() => {
    if (phase !== 'idle') return;
    const onLayout = () => applyLayout(displayedStep);
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [phase, applyLayout, displayedStep]);

  useEffect(() => {
    if (phase !== 'morph') return;

    const swapMs = MORPH_MS * MORPH_TEXT_SWAP_AT;
    const endMs = MORPH_MS + 32;

    const swapId = window.setTimeout(() => {
      setDisplayedStep(step);
      setDisplayedChildren(step.id === 'permissions' ? children : null);
    }, swapMs);

    const endId = window.setTimeout(() => {
      lastCenterRef.current = centerForStep(step, boxSizeRef.current);
      setPhase('idle');
    }, endMs);

    return () => {
      window.clearTimeout(swapId);
      window.clearTimeout(endId);
    };
  }, [phase, step, children]);

  return (
    <>
      <div
        ref={hiddenMeasureRef}
        className="pointer-events-none fixed top-0 -left-[10000px] opacity-0"
        aria-hidden
        style={{ width: cardWidthFor(step) }}
      >
        <TutorialStepCardFrame>
          <div className="relative">
            <TutorialCardContent
              step={step}
              showWakeHint={showWakeHint}
              permissionsChildren={step.id === 'permissions' ? children : undefined}
              canBack={false}
              canNext={false}
              onBack={() => {}}
              onNext={() => {}}
              titleId="tutorial-measure-title"
              interactive={false}
            />
          </div>
        </TutorialStepCardFrame>
      </div>

      <motion.div
        ref={shellRef}
        data-tutorial-card
        role="dialog"
        aria-labelledby="tutorial-card-title"
        className={cn(
          'pointer-events-auto fixed overflow-visible -translate-x-1/2 -translate-y-1/2 z-[10001]',
        )}
        initial={false}
        animate={{
          top: center.top,
          left: center.left,
          width: boxSize.width,
          height: boxSize.height,
          opacity: ready ? 1 : 0,
        }}
        transition={{
          top: boxTransition,
          left: boxTransition,
          width: boxTransition,
          height: boxTransition,
          opacity: { duration: reduceMotion ? 0 : 0.1 },
        }}
      >
        <TutorialStepCardFrame className="h-full w-full">
          <div className="relative">
            <motion.div
              className="relative"
              initial={false}
              animate={{ opacity: phase === 'morph' ? MORPH_TEXT_OPACITY : 1 }}
              transition={{ opacity: textTransition }}
              style={{ pointerEvents: phase === 'idle' ? 'auto' : 'none' }}
            >
              <TutorialCardContent
                step={displayedStep}
                showWakeHint={showWakeHint}
                permissionsChildren={
                  displayedStep.id === 'permissions' ? displayedChildren : undefined
                }
                canBack={canBack}
                canNext={canNext}
                onBack={onBack}
                onNext={onNext}
                titleId="tutorial-card-title"
                interactive={phase === 'idle'}
              />
            </motion.div>
          </div>
        </TutorialStepCardFrame>
      </motion.div>
    </>
  );
}
