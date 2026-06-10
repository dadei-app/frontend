import { isFinishTutorialStep, isTutorialConversationDeleteStep } from '@dadei/ui/lib/tutorial/constants';
import { isTutorialTestInteractionTarget } from '@dadei/ui/lib/tutorial/testData';
import type { TutorialStep } from '@dadei/ui/types/tutorial.types';

export function stepInteractables(step: TutorialStep): string[] {
  return step.interactables ?? [];
}

/** Whether a `data-tutorial-target` should accept clicks and show hover affordances. */
export function isTutorialTargetInteractive(
  targetKey: string | null | undefined,
  step: TutorialStep | undefined,
): boolean {
  if (!step) return true;
  if (isFinishTutorialStep(step.id)) return false;
  if (!targetKey) return false;
  return stepInteractables(step).includes(targetKey);
}

export function isTutorialClickAllowed(target: EventTarget | null, step: TutorialStep): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.closest('[data-tutorial-card]')) return true;
  if (el.closest('[data-tutorial-settings-guide]')) return true;
  if (el.closest('[data-tutorial-target="settings-panel-root"]')) return true;
  if (isFinishTutorialStep(step.id)) return false;
  if (el.closest('[data-tutorial-allow-logout]')) return true;
  if (
    el.closest('[data-split-delete]') &&
    el.closest('[data-tutorial-target="tutorial-test-conversation"]') &&
    !isTutorialConversationDeleteStep(step.id) &&
    !isTutorialTestInteractionTarget(el)
  ) {
    return false;
  }
  for (const key of stepInteractables(step)) {
    if (el.closest(`[data-tutorial-target="${key}"]`)) return true;
  }
  return false;
}
