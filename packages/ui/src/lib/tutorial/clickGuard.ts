import type { TutorialStep } from '@dadei/ui/types/tutorial.types';

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
