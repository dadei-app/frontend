import { useMemo, useRef } from 'react';
import TutorialArrow from './TutorialArrow';
import type { TutorialStep } from './types';

function tutorialArrowZ(step: TutorialStep): string {
  if (step.id.startsWith('settings_') || step.id === 'settings_walkthrough') {
    return 'z-[10049]';
  }
  return 'z-[10000]';
}

export default function ArrowLayer({
  step,
  cardRef,
}: {
  step: TutorialStep;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const layerRef = useRef<SVGSVGElement>(null);

  const targetEl = useMemo(() => {
    if (!step.targetKey) return null;
    return document.querySelector(`[data-tutorial-target="${step.targetKey}"]`) as HTMLElement | null;
  }, [step.targetKey, step.id]);

  if (!step.targetKey || !targetEl) return null;

  return (
    <svg
      ref={layerRef}
      className={`pointer-events-none fixed inset-0 ${tutorialArrowZ(step)}`}
      aria-hidden
    >
      <defs>
        <marker
          id="tutorial-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#00cc6a" />
        </marker>
      </defs>
      <TutorialArrow cardRef={cardRef} targetRef={targetEl} />
      <style>{`
        .tutorial-arrow-march {
          animation: tutorial-arrow-march 0.8s linear infinite;
        }
        @keyframes tutorial-arrow-march {
          to { stroke-dashoffset: -14; }
        }
      `}</style>
    </svg>
  );
}
