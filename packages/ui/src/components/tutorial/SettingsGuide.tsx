import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTutorialContext } from '@dadei/ui/contexts/TutorialContext';
import { useNeedsTutorial } from '@dadei/ui/lib/query/queryHooks';
import { isSettingsTutorialStep } from '@dadei/ui/lib/tutorial/constants';
import { cn } from '@dadei/ui/lib/shared/cn';
import { CardNav } from './Card';

function settingsStepsFrom(steps: { id: string }[]) {
  return steps.filter(s => isSettingsTutorialStep(s.id));
}

export default function SettingsGuide() {
  const ctx = useTutorialContext();
  const needsTutorial = useNeedsTutorial();
  const reduceMotion = useReducedMotion();

  const step = ctx?.step;
  const active = Boolean(needsTutorial && step && isSettingsTutorialStep(step.id));

  const settingsSteps = ctx ? settingsStepsFrom(ctx.steps) : [];
  const progressIndex = step ? settingsSteps.findIndex(s => s.id === step.id) : -1;
  const canBack = (ctx?.currentStepIndex ?? 0) > 0;
  const canNext = !step?.actionTriggers?.length;

  useEffect(() => {
    if (!active || !ctx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && canNext) {
        e.preventDefault();
        ctx.next();
      }
      if (e.key === 'ArrowLeft' && canBack) {
        e.preventDefault();
        ctx.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, canBack, canNext, ctx]);

  if (!active || !ctx || !step) return null;

  return (
    <div
      data-tutorial-settings-guide
      className={cn(
        'shrink-0 border-t border-emerald-500/20',
        'bg-gradient-to-t from-zinc-950/95 via-zinc-950/90 to-zinc-950/75',
        'px-4 py-2.5 backdrop-blur-xl',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-emerald-400/90">
              Tutorial
            </span>
            <span className="text-[0.65rem] tabular-nums text-zinc-500">
              {progressIndex + 1} / {settingsSteps.length}
            </span>
          </div>
          <motion.div
            key={step.id}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
          >
            <h3 className="font-primary text-sm font-semibold leading-snug text-zinc-50">
              {step.title}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-400 font-secondary">{step.body}</p>
          </motion.div>
          <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
            {settingsSteps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i === progressIndex ? 'w-4 bg-emerald-400/90' : 'w-1 bg-zinc-600/80',
                )}
              />
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <CardNav
            canBack={canBack}
            canNext={Boolean(canNext)}
            onBack={ctx.back}
            onNext={ctx.next}
          />
        </div>
      </div>
    </div>
  );
}
