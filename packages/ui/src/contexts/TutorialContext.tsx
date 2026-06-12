import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@dadei/ui/lib/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/api/http/constants';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import {
  adjacentTutorialStepIndex,
  buildTutorialSteps,
  isSettingsTutorialStep,
  TUTORIAL_STEP_EVENT,
} from '@dadei/ui/lib/tutorial/constants';
import { preloadAmbientShader } from '@dadei/ui/components/settings/AmbientShader';
import { isTutorialTargetInteractive } from '@dadei/ui/lib/tutorial/clickGuard';
import {
  buildTutorialFixtures,
  isTutorialTestId,
} from '@dadei/ui/lib/tutorial/testData';
import type { ActionTrigger, TutorialStep } from '@dadei/ui/types/tutorial.types';
import type { UserMe } from '@dadei/ui/types/auth.types';
import type { Conversation, Interaction, Person } from '@dadei/ui/types/models.types';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useNeedsTutorial } from '@dadei/ui/lib/query/queryHooks';

export interface TutorialContextValue {
  isActive: boolean;
  steps: TutorialStep[];
  currentStepIndex: number;
  step: TutorialStep;
  totalSteps: number;
  next: () => void;
  back: () => void;
  markActionFired: (trigger: ActionTrigger) => void;
  isCurrentStepActionComplete: boolean;
  tutorialPersons: Person[];
  tutorialInteractions: Interaction[];
  tutorialConversations: Conversation[];
  removeTutorialInteraction: (id: string) => void;
  removeTutorialConversation: () => void;
  removeTutorialPerson: () => void;
  recordTutorialInteraction: () => void;
  wakeWordEnabled: boolean;
  openSettingsForTutorial: boolean;
  setOpenSettingsForTutorial: (open: boolean) => void;
  showTestNotifications: boolean;
  finishTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

function isTriggerComplete(
  trigger: ActionTrigger,
  step: TutorialStep,
  flags: {
    expandConversationDone: boolean;
    removedInteractionIds: Set<string>;
    personRemoved: boolean;
    serviceEnabledFired: boolean;
    tutorialInteractionCount: number;
    conversationRemoved: boolean;
  },
): boolean {
  switch (trigger) {
    case 'expand-conversation':
      return flags.expandConversationDone;
    case 'delete-conversation':
      return flags.conversationRemoved;
    case 'delete-interaction':
      return flags.removedInteractionIds.size > 0;
    case 'delete-person':
      return flags.personRemoved;
    case 'service-enabled':
      return flags.serviceEnabledFired;
    case 'interactions-logged':
      return flags.tutorialInteractionCount >= (step.requiredInteractions ?? 2);
    default:
      return false;
  }
}

function isStepActionComplete(
  step: TutorialStep | undefined,
  flags: {
    expandConversationDone: boolean;
    removedInteractionIds: Set<string>;
    personRemoved: boolean;
    serviceEnabledFired: boolean;
    tutorialInteractionCount: number;
    conversationRemoved: boolean;
  },
): boolean {
  const triggers = step?.actionTriggers;
  if (!triggers?.length) return true;
  return triggers.every(trigger => isTriggerComplete(trigger, step!, flags));
}

export function TutorialProvider({
  children,
  forceInactive = false,
}: {
  children: ReactNode;
  forceInactive?: boolean;
}) {
  const { isElectron } = useSystem();
  const { persons } = useService();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tutorialFinished, setTutorialFinished] = useState(false);
  const [removedInteractionIds, setRemovedInteractionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [conversationRemoved, setConversationRemoved] = useState(false);
  const [personRemoved, setPersonRemoved] = useState(false);
  const [tutorialInteractionCount, setTutorialInteractionCount] = useState(0);
  const [expandConversationDone, setExpandConversationDone] = useState(false);
  const [serviceEnabledFired, setServiceEnabledFired] = useState(false);
  const [openSettingsForTutorial, setOpenSettingsForTutorial] = useState(false);

  const fixtures = useMemo(() => {
    const userPerson = persons.find(p => p.is_user);
    const anchorIso = userPerson?.created_at ?? new Date().toISOString();
    return buildTutorialFixtures(anchorIso);
  }, [persons]);

  const steps = useMemo(() => buildTutorialSteps(isElectron), [isElectron]);
  const step = steps[currentStepIndex] ?? steps[0];
  const totalSteps = steps.length;

  const actionFlags = useMemo(
    () => ({
      expandConversationDone,
      removedInteractionIds,
      personRemoved,
      serviceEnabledFired,
      tutorialInteractionCount,
      conversationRemoved,
    }),
    [
      expandConversationDone,
      removedInteractionIds,
      personRemoved,
      serviceEnabledFired,
      tutorialInteractionCount,
      conversationRemoved,
    ],
  );

  const isCurrentStepActionComplete = useMemo(
    () => isStepActionComplete(step, actionFlags),
    [step, actionFlags],
  );

  const publishStep = useCallback((index: number) => {
    window.dispatchEvent(
      new CustomEvent(TUTORIAL_STEP_EVENT, { detail: { stepIndex: index } }),
    );
  }, []);

  useEffect(() => {
    preloadAmbientShader();
  }, []);

  const finishTutorial = useCallback(() => {
    setTutorialFinished(true);
  }, []);

  const next = useCallback(() => {
    setCurrentStepIndex(prev => {
      const current = steps[prev];
      if (current?.actionTriggers?.length && !isStepActionComplete(current, actionFlags)) {
        return prev;
      }
      const nextIndex = adjacentTutorialStepIndex(steps, prev, 1);
      publishStep(nextIndex);
      return nextIndex;
    });
  }, [steps, actionFlags, publishStep]);

  const back = useCallback(() => {
    setCurrentStepIndex(prev => {
      const nextIndex = adjacentTutorialStepIndex(steps, prev, -1);
      publishStep(nextIndex);
      return nextIndex;
    });
  }, [publishStep, steps]);

  const markActionFired = useCallback(
    (trigger: ActionTrigger) => {
      const current = steps[currentStepIndex];
      const wasAlreadyComplete = current
        ? isStepActionComplete(current, actionFlags)
        : false;

      if (trigger === 'expand-conversation') setExpandConversationDone(true);
      if (trigger === 'delete-conversation') setConversationRemoved(true);
      if (trigger === 'service-enabled') setServiceEnabledFired(true);
      if (trigger === 'interactions-logged') {
        const required = steps[currentStepIndex]?.requiredInteractions ?? 2;
        setTutorialInteractionCount(required);
      }

      setCurrentStepIndex(prev => {
        const stepAtIndex = steps[prev];
        if (
          !stepAtIndex?.actionTriggers?.includes(trigger) ||
          !stepAtIndex.autoAdvanceOnAction ||
          wasAlreadyComplete
        ) {
          return prev;
        }
        const nextIndex = Math.min(prev + 1, steps.length - 1);
        publishStep(nextIndex);
        return nextIndex;
      });
    },
    [steps, currentStepIndex, actionFlags, publishStep],
  );

  const removeTutorialInteraction = useCallback((id: string) => {
    if (!isTutorialTestId(id)) return;
    setRemovedInteractionIds(prev => new Set(prev).add(id));
  }, []);

  const removeTutorialConversation = useCallback(() => {
    setConversationRemoved(true);
  }, []);

  const removeTutorialPerson = useCallback(() => {
    setPersonRemoved(true);
  }, []);

  const recordTutorialInteraction = useCallback(() => {
    setTutorialInteractionCount(prev => {
      const nextCount = prev + 1;
      const current = steps[currentStepIndex];
      const required = current?.requiredInteractions ?? 2;
      if (
        current?.actionTriggers?.includes('interactions-logged') &&
        nextCount >= required &&
        current.autoAdvanceOnAction
      ) {
        setTimeout(() => markActionFired('interactions-logged'), 0);
      }
      return nextCount;
    });
  }, [currentStepIndex, steps, markActionFired]);

  const tutorialInteractions = useMemo(() => {
    if (conversationRemoved) return [];
    return fixtures.interactions.filter(i => !removedInteractionIds.has(i.id));
  }, [fixtures.interactions, removedInteractionIds, conversationRemoved]);

  const tutorialPersons = useMemo(() => {
    if (personRemoved) return [];
    return [fixtures.person];
  }, [fixtures.person, personRemoved]);

  const tutorialConversations = useMemo(() => {
    if (conversationRemoved) return [];
    return [fixtures.conversation];
  }, [fixtures.conversation, conversationRemoved]);

  const wakeWordEnabled = false;
  const showTestNotifications = step.id === 'layout_tour';

  const value = useMemo<TutorialContextValue>(
    () => ({
      isActive: !forceInactive && !tutorialFinished,
      steps,
      currentStepIndex,
      step,
      totalSteps,
      next,
      back,
      markActionFired,
      isCurrentStepActionComplete,
      tutorialPersons,
      tutorialInteractions,
      tutorialConversations,
      removeTutorialInteraction,
      removeTutorialConversation,
      removeTutorialPerson,
      recordTutorialInteraction,
      wakeWordEnabled,
      openSettingsForTutorial,
      setOpenSettingsForTutorial,
      showTestNotifications,
      finishTutorial,
    }),
    [
      forceInactive,
      tutorialFinished,
      steps,
      currentStepIndex,
      step,
      totalSteps,
      next,
      back,
      markActionFired,
      isCurrentStepActionComplete,
      tutorialPersons,
      tutorialInteractions,
      tutorialConversations,
      removeTutorialInteraction,
      removeTutorialConversation,
      removeTutorialPerson,
      recordTutorialInteraction,
      openSettingsForTutorial,
      showTestNotifications,
      finishTutorial,
    ],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorialContext(): TutorialContextValue | null {
  return useContext(TutorialContext);
}

/** Overlay orchestration: completion, scroll-into-view, settings sync. Requires TutorialProvider. */
export function useTutorial() {
  const ctx = useTutorialContext();
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }

  const queryClient = useQueryClient();

  const scrollTargetIntoView = useCallback((targetKey: string | null) => {
    if (!targetKey) return;
    const el = document.querySelector(`[data-tutorial-target="${targetKey}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const persistTutorialCompletion = useCallback(async () => {
    await api.post(ENDPOINTS.TUTORIAL_COMPLETE);
  }, []);

  const markTutorialCompletedClient = useCallback(() => {
    queryClient.setQueryData<UserMe | undefined>(queryKeys.authMe, prev =>
      prev ? { ...prev, tutorial_completed: true } : prev,
    );
  }, [queryClient]);

  const completeTutorial = useCallback(async () => {
    await persistTutorialCompletion();
    markTutorialCompletedClient();
  }, [markTutorialCompletedClient, persistTutorialCompletion]);

  useEffect(() => {
    scrollTargetIntoView(ctx.step.targetKey);
    if (isSettingsTutorialStep(ctx.step.id)) {
      ctx.setOpenSettingsForTutorial(true);
    } else if (ctx.openSettingsForTutorial) {
      ctx.setOpenSettingsForTutorial(false);
    }
  }, [ctx, scrollTargetIntoView]);

  return {
    ...ctx,
    completeTutorial,
    persistTutorialCompletion,
    markTutorialCompletedClient,
  };
}

/** True while onboarding is incomplete and the tutorial overlay is still running. */
export function useTutorialEngaged(): boolean {
  const needsTutorial = useNeedsTutorial();
  const tutorial = useTutorialContext();
  return Boolean(needsTutorial && tutorial?.isActive);
}

/** True during the in-settings guided tour (sidebar locked, SettingsGuide visible). */
export function useTutorialSettingsTourActive(): boolean {
  const tutorial = useTutorialContext();
  const engaged = useTutorialEngaged();
  return Boolean(engaged && tutorial && isSettingsTutorialStep(tutorial.step.id));
}

export function useTutorialTargetInteractive(targetKey: string | null | undefined): boolean {
  if (!useTutorialEngaged()) return true;
  const tutorial = useTutorialContext();
  return isTutorialTargetInteractive(targetKey, tutorial?.step);
}
