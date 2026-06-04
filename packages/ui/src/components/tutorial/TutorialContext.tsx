import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Conversation, Interaction, Person } from '@dadei/ui/types/models.types';
import {
  MIC_UNLOCK_STEP_INDEX,
  STEPS,
  TUTORIAL_STEP_EVENT,
  WAKE_UNLOCK_STEP_INDEX,
} from './constants';
import {
  TEST_CONVERSATION,
  TEST_INTERACTIONS,
  TEST_PERSON,
  isTutorialTestId,
} from './testData';
import type { ActionTrigger, TutorialStep } from './types';

export interface TutorialContextValue {
  isActive: boolean;
  steps: TutorialStep[];
  currentStepIndex: number;
  step: TutorialStep;
  totalSteps: number;
  next: () => void;
  back: () => void;
  markActionFired: (trigger: ActionTrigger) => void;
  acknowledgePermissions: () => void;
  permissionsResolved: boolean;
  tutorialPersons: Person[];
  tutorialInteractions: Interaction[];
  tutorialConversations: Conversation[];
  removeTutorialInteraction: (id: string) => void;
  removeTutorialConversation: () => void;
  removeTutorialPerson: () => void;
  recordTutorialInteraction: () => void;
  micInteractive: boolean;
  wakeWordEnabled: boolean;
  tutorialCommandMode: boolean;
  openSettingsForTutorial: boolean;
  setOpenSettingsForTutorial: (open: boolean) => void;
  showTestNotifications: boolean;
  wakeHintVisible: boolean;
  wakeSessionEnded: boolean;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [removedInteractionIds, setRemovedInteractionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [conversationRemoved, setConversationRemoved] = useState(false);
  const [personRemoved, setPersonRemoved] = useState(false);
  const [tutorialInteractionCount, setTutorialInteractionCount] = useState(0);
  const [permissionsResolved, setPermissionsResolved] = useState(false);
  const [serviceEnabledFired, setServiceEnabledFired] = useState(false);
  const [wakeSessionEnded, setWakeSessionEnded] = useState(false);
  const [targetClicked, setTargetClicked] = useState(false);
  const [openSettingsForTutorial, setOpenSettingsForTutorial] = useState(false);

  const steps = STEPS;
  const step = steps[currentStepIndex] ?? steps[0];
  const totalSteps = steps.length;

  const publishStep = useCallback((index: number) => {
    window.dispatchEvent(
      new CustomEvent(TUTORIAL_STEP_EVENT, { detail: { stepIndex: index } }),
    );
  }, []);

  useEffect(() => {
    setTargetClicked(false);
  }, [currentStepIndex]);

  const tryAdvanceFromAction = useCallback(
    (index: number) => {
      const current = steps[index];
      if (!current?.actionTrigger) return false;
      switch (current.actionTrigger) {
        case 'permission-resolved':
          return permissionsResolved;
        case 'delete-interaction':
          return removedInteractionIds.size > 0;
        case 'delete-conversation':
          return conversationRemoved;
        case 'delete-person':
          return personRemoved;
        case 'service-enabled':
          return serviceEnabledFired;
        case 'interactions-logged':
          return tutorialInteractionCount >= (current.requiredInteractions ?? 2);
        case 'wake-session-ended':
          return wakeSessionEnded;
        case 'click':
          return targetClicked;
        default:
          return false;
      }
    },
    [
      steps,
      permissionsResolved,
      removedInteractionIds,
      conversationRemoved,
      personRemoved,
      serviceEnabledFired,
      tutorialInteractionCount,
      wakeSessionEnded,
      targetClicked,
    ],
  );

  const next = useCallback(() => {
    setCurrentStepIndex(prev => {
      const current = steps[prev];
      if (current?.actionTrigger && !tryAdvanceFromAction(prev)) {
        return prev;
      }
      if (current?.kind === 'action' && !tryAdvanceFromAction(prev)) {
        return prev;
      }
      const nextIndex = Math.min(prev + 1, steps.length - 1);
      publishStep(nextIndex);
      return nextIndex;
    });
  }, [steps, tryAdvanceFromAction, publishStep]);

  const back = useCallback(() => {
    setCurrentStepIndex(prev => {
      const nextIndex = Math.max(prev - 1, 0);
      publishStep(nextIndex);
      return nextIndex;
    });
  }, [publishStep]);

  const acknowledgePermissions = useCallback(() => {
    setPermissionsResolved(true);
  }, []);

  const markActionFired = useCallback(
    (trigger: ActionTrigger) => {
      if (trigger === 'permission-resolved') setPermissionsResolved(true);
      if (trigger === 'service-enabled') setServiceEnabledFired(true);
      if (trigger === 'wake-session-ended') setWakeSessionEnded(true);
      if (trigger === 'click') setTargetClicked(true);
      setCurrentStepIndex(prev => {
        const current = steps[prev];
        if (current?.actionTrigger !== trigger) return prev;
        if (!tryAdvanceFromAction(prev)) {
          if (trigger === 'permission-resolved' || trigger === 'click') {
            const nextIndex = Math.min(prev + 1, steps.length - 1);
            publishStep(nextIndex);
            return nextIndex;
          }
          return prev;
        }
        const nextIndex = Math.min(prev + 1, steps.length - 1);
        publishStep(nextIndex);
        return nextIndex;
      });
    },
    [steps, tryAdvanceFromAction, publishStep],
  );

  const removeTutorialInteraction = useCallback((id: string) => {
    if (!isTutorialTestId(id)) return;
    setRemovedInteractionIds(prev => new Set(prev).add(id));
    markActionFired('delete-interaction');
  }, [markActionFired]);

  const removeTutorialConversation = useCallback(() => {
    setConversationRemoved(true);
    markActionFired('delete-conversation');
  }, [markActionFired]);

  const removeTutorialPerson = useCallback(() => {
    setPersonRemoved(true);
    markActionFired('delete-person');
  }, [markActionFired]);

  const recordTutorialInteraction = useCallback(() => {
    setTutorialInteractionCount(prev => {
      const nextCount = prev + 1;
      const required = steps[currentStepIndex]?.requiredInteractions ?? 2;
      if (
        steps[currentStepIndex]?.actionTrigger === 'interactions-logged' &&
        nextCount >= required
      ) {
        setTimeout(() => markActionFired('interactions-logged'), 0);
      }
      return nextCount;
    });
  }, [currentStepIndex, steps, markActionFired]);

  const tutorialInteractions = useMemo(() => {
    if (conversationRemoved) return [];
    return TEST_INTERACTIONS.filter(i => !removedInteractionIds.has(i.id));
  }, [removedInteractionIds, conversationRemoved]);

  const tutorialPersons = useMemo(() => {
    if (personRemoved) return [];
    return [TEST_PERSON];
  }, [personRemoved]);

  const tutorialConversations = useMemo(() => {
    if (conversationRemoved) return [];
    return [TEST_CONVERSATION];
  }, [conversationRemoved]);

  const micInteractive = currentStepIndex >= MIC_UNLOCK_STEP_INDEX;
  const wakeWordEnabled = currentStepIndex >= WAKE_UNLOCK_STEP_INDEX;
  const tutorialCommandMode =
    wakeWordEnabled && step.id === 'wake_word_demo' && !wakeSessionEnded;
  const showTestNotifications = step.id === 'layout_tour';
  const wakeHintVisible = step.id === 'wake_word_demo';

  const value = useMemo<TutorialContextValue>(
    () => ({
      isActive: true,
      steps,
      currentStepIndex,
      step,
      totalSteps,
      next,
      back,
      markActionFired,
      acknowledgePermissions,
      permissionsResolved,
      tutorialPersons,
      tutorialInteractions,
      tutorialConversations,
      removeTutorialInteraction,
      removeTutorialConversation,
      removeTutorialPerson,
      recordTutorialInteraction,
      micInteractive,
      wakeWordEnabled,
      tutorialCommandMode,
      openSettingsForTutorial,
      setOpenSettingsForTutorial,
      showTestNotifications,
      wakeHintVisible,
      wakeSessionEnded,
    }),
    [
      steps,
      currentStepIndex,
      step,
      totalSteps,
      next,
      back,
      markActionFired,
      acknowledgePermissions,
      permissionsResolved,
      tutorialPersons,
      tutorialInteractions,
      tutorialConversations,
      removeTutorialInteraction,
      removeTutorialConversation,
      removeTutorialPerson,
      recordTutorialInteraction,
      micInteractive,
      wakeWordEnabled,
      tutorialCommandMode,
      openSettingsForTutorial,
      showTestNotifications,
      wakeHintVisible,
      wakeSessionEnded,
    ],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorialContext(): TutorialContextValue | null {
  return useContext(TutorialContext);
}
