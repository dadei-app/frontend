import type { TutorialStep } from './types';

export function allowedClickTargetKeys(step: TutorialStep): string[] {
  if (step.allowedClickTargets?.length) return step.allowedClickTargets;
  if (step.targetKey) return [step.targetKey];
  return [];
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
