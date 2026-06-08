import { useTutorialContext } from './TutorialContext';
import type { TutorialStep } from './types';

export function allowedClickTargetKeys(step: TutorialStep): string[] {
  if (step.allowedClickTargets?.length) return step.allowedClickTargets;
  if (step.targetKey) return [step.targetKey];
  return [];
}

/** Whether a `data-tutorial-target` should accept clicks and show hover affordances. */
export function isTutorialTargetInteractive(
  targetKey: string | null | undefined,
  step: TutorialStep | undefined,
): boolean {
  if (!step) return true;
  if (step.kind !== 'action') return true;
  if (!targetKey) return false;
  return allowedClickTargetKeys(step).includes(targetKey);
}

export function useTutorialTargetInteractive(targetKey: string | null | undefined): boolean {
  const tutorial = useTutorialContext();
  if (!tutorial) return true;
  return isTutorialTargetInteractive(targetKey, tutorial.step);
}

/** Non-target UI (e.g. panel chrome buttons) during action steps. */
export function useTutorialChromeInteractive(): boolean {
  const tutorial = useTutorialContext();
  if (!tutorial) return true;
  return tutorial.step.kind !== 'action';
}

export function isTutorialClickAllowed(target: EventTarget | null, step: TutorialStep): boolean {
  if (step.kind !== 'action') return true;
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.closest('[data-tutorial-card]')) return true;
  if (el.closest('[data-tutorial-allow-logout]')) return true;
  for (const key of allowedClickTargetKeys(step)) {
    if (el.closest(`[data-tutorial-target="${key}"]`)) return true;
  }
  return false;
}
