import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@dadei/ui/lib/shared/cn';
import {
  TUTORIAL_MORPH_MS,
  TUTORIAL_MORPH_TRANSITION,
} from '@dadei/ui/lib/tutorial/motion';
import type { TutorialStep } from '@dadei/ui/types/tutorial.types';

const KNOB_CLASS =
  'flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 text-zinc-400 shadow-sm transition hover:border-emerald-500/25 hover:bg-zinc-800 hover:text-emerald-200 disabled:pointer-events-none disabled:opacity-30';

const CONFIRM_KNOB_CLASS =
  'flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-950/70 text-emerald-200 shadow-sm shadow-emerald-950/40 transition hover:border-emerald-300/50 hover:bg-emerald-900/60 hover:text-emerald-100 disabled:pointer-events-none disabled:opacity-30';

const CARD_MARGIN = 16;
const CARD_WIDTH = 384;

function cardWidthFor(_step: TutorialStep) {
  return CARD_WIDTH;
}

const MORPH_MS = TUTORIAL_MORPH_MS;
const MORPH_BOX = TUTORIAL_MORPH_TRANSITION;
/** Text fades out, brief hold, fades in — swap while fully transparent. */
const MORPH_TEXT_OPACITY = [1, 0, 0, 1];
const MORPH_TEXT_TIMES = [0, 0.32, 0.4, 1] as const;
const MORPH_TEXT_SWAP_AT = 0.36;

type Phase = 'idle' | 'morph';

type BoxSize = { width: number; height: number };
type Point = { top: number; left: number };

/** Pulsing emerald ring around step card content. */
function StepCardFrame({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'relative overflow-visible rounded-2xl border border-emerald-200/60 bg-zinc-950/80',
        'shadow-[0_0_0_1px_rgba(167,243,208,0.3)_inset,0_18px_50px_-18px_rgba(16,185,129,0.45)]',
        'backdrop-blur-xl',
        className,
      )}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-2xl border border-emerald-200/45"
        style={{ transformOrigin: '50% 50%' }}
        initial={{ scale: 1, opacity: 0.85 }}
        animate={
          reduceMotion
            ? { scale: 1, opacity: 0.5 }
            : {
                scale: [1, 1, 1.12, 1.12, 1, 1],
                opacity: [0.85, 0.85, 0.25, 0.25, 0.85, 0.85],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                duration: 8,
                times: [0, 0.1, 0.22, 0.52, 0.72, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      />
      <div className="relative z-10 p-5">{children}</div>
    </div>
  );
}

export function CardNav({
  canBack,
  canNext,
  onBack,
  onNext,
  confirmFinish = false,
}: {
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  confirmFinish?: boolean;
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
        className={confirmFinish ? CONFIRM_KNOB_CLASS : KNOB_CLASS}
        aria-label={confirmFinish ? 'Finish tutorial' : 'Next step'}
        disabled={!canNext}
        onClick={onNext}
      >
        {confirmFinish ? (
          <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
        ) : (
          <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
        )}
      </button>
    </nav>
  );
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
    return clampTopLeft(pos, cardW, cardH);
  }
  if (placement === 'right') {
    const pos = { top: rowAlignedY, left: rect.right + CARD_MARGIN };
    return clampTopLeft(pos, cardW, cardH);
  }
  if (placement === 'below') {
    const pos = { top: rect.bottom + CARD_MARGIN, left: cx - cardW / 2 };
    return clampTopLeft(pos, cardW, cardH);
  }
  if (placement === 'above') {
    const pos = { top: rect.top - cardH - CARD_MARGIN, left: cx - cardW / 2 };
    return clampTopLeft(pos, cardW, cardH);
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

function CardBody({ step }: { step: TutorialStep }) {
  return (
    <>
      <h2 className="pr-[4.25rem] font-primary text-lg font-semibold leading-tight text-zinc-50">
        {step.title}
      </h2>
      {step.body.trim() ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-300 font-secondary">{step.body}</p>
      ) : null}
    </>
  );
}

function CardContent({
  step,
  canBack,
  canNext,
  onBack,
  onNext,
  titleId,
  interactive,
  confirmFinish,
}: {
  step: TutorialStep;
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  titleId: string;
  interactive: boolean;
  confirmFinish?: boolean;
}) {
  return (
    <>
      <div
        className={`absolute top-0 right-0 z-20 ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <CardNav
          canBack={canBack}
          canNext={canNext}
          onBack={onBack}
          onNext={onNext}
          confirmFinish={confirmFinish}
        />
      </div>
      <h2 id={titleId} className="sr-only">
        {step.title}
      </h2>
      <CardBody step={step} />
    </>
  );
}

export default function Card({
  step,
  canBack,
  canNext,
  onBack,
  onNext,
}: {
  step: TutorialStep;
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const confirmFinish = Boolean(step.startsIntroduction);
  const reduceMotion = useReducedMotion();
  const shellRef = useRef<HTMLDivElement>(null);
  const hiddenMeasureRef = useRef<HTMLDivElement>(null);
  const initialSize = defaultBoxSize(step);
  const boxSizeRef = useRef<BoxSize>(initialSize);
  const lastCenterRef = useRef<Point | null>(null);

  const [center, setCenter] = useState<Point>(() => centerForStep(step, initialSize));
  const [ready, setReady] = useState(false);
  const [displayedStep, setDisplayedStep] = useState(step);
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
      lastCenterRef.current = nextCenter;
      setPhase('idle');
      return;
    }

    setPhase('morph');
  }, [step, measureStepSize, reduceMotion]);

  useLayoutEffect(() => {
    if (phase !== 'idle') return;
    applyLayout(step);
    setReady(true);
  }, [step, phase, applyLayout]);

  useEffect(() => {
    if (step.id === displayedStep.id) return;
    if (phase !== 'idle') return;
    startMorph();
  }, [step.id, displayedStep.id, phase, startMorph]);

  useEffect(() => {
    if (phase !== 'idle') return;
    const onLayout = () => applyLayout(displayedStep);
    window.addEventListener('resize', onLayout);
    return () => window.removeEventListener('resize', onLayout);
  }, [phase, applyLayout, displayedStep]);

  useEffect(() => {
    if (phase !== 'idle') return;
    const anchorKey = displayedStep.cardAnchorKey ?? displayedStep.targetKey;
    if (!anchorKey) return;
    const anchor = document.querySelector(`[data-tutorial-target="${anchorKey}"]`);
    if (!anchor) return;
    if (anchorKey === 'interaction-panel-root') {
      applyLayout(displayedStep);
      return;
    }
    const onAnchorLayout = () => applyLayout(displayedStep);
    const ro = new ResizeObserver(onAnchorLayout);
    ro.observe(anchor);
    return () => ro.disconnect();
  }, [phase, applyLayout, displayedStep]);

  useEffect(() => {
    if (phase !== 'morph') return;

    const swapMs = MORPH_MS * MORPH_TEXT_SWAP_AT;
    const endMs = MORPH_MS + 32;

    const swapId = window.setTimeout(() => {
      setDisplayedStep(step);
    }, swapMs);

    const endId = window.setTimeout(() => {
      lastCenterRef.current = centerForStep(step, boxSizeRef.current);
      setPhase('idle');
    }, endMs);

    return () => {
      window.clearTimeout(swapId);
      window.clearTimeout(endId);
    };
  }, [phase, step]);

  return (
    <>
      <div
        ref={hiddenMeasureRef}
        className="pointer-events-none fixed top-0 -left-[10000px] opacity-0"
        aria-hidden
        style={{ width: cardWidthFor(step) }}
      >
        <StepCardFrame>
          <div className="relative">
            <CardContent
              step={step}
              canBack={false}
              canNext={false}
              onBack={() => {}}
              onNext={() => {}}
              titleId="tutorial-measure-title"
              interactive={false}
            />
          </div>
        </StepCardFrame>
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
        <StepCardFrame className="h-full w-full">
          <div className="relative">
            <motion.div
              className="relative"
              initial={false}
              animate={{ opacity: phase === 'morph' ? MORPH_TEXT_OPACITY : 1 }}
              transition={{ opacity: textTransition }}
              style={{ pointerEvents: phase === 'idle' ? 'auto' : 'none' }}
            >
              <CardContent
                step={displayedStep}
                canBack={canBack}
                canNext={canNext}
                onBack={onBack}
                onNext={onNext}
                titleId="tutorial-card-title"
                interactive={phase === 'idle'}
                confirmFinish={confirmFinish}
              />
            </motion.div>
          </div>
        </StepCardFrame>
      </motion.div>
    </>
  );
}
