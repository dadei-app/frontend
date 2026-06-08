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
  buildTutorialFixtures,
  isTutorialTestId,
} from './testData';
import type { ActionTrigger, TutorialStep } from './types';
import { useService } from '@dadei/ui/contexts/ServiceContext';

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
  isCurrentStepActionComplete: boolean;
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

function isStepActionComplete(
  step: TutorialStep | undefined,
  flags: {
    permissionsResolved: boolean;
    expandConversationDone: boolean;
    notificationsDismissed: boolean;
    removedInteractionIds: Set<string>;
    personRemoved: boolean;
    serviceEnabledFired: boolean;
    tutorialInteractionCount: number;
    wakeSessionEnded: boolean;
  },
): boolean {
  if (!step?.actionTrigger) return true;
  switch (step.actionTrigger) {
    case 'permission-resolved':
      return flags.permissionsResolved;
    case 'expand-conversation':
      return flags.expandConversationDone;
    case 'notifications-dismissed':
      return flags.notificationsDismissed;
    case 'delete-interaction':
      return flags.removedInteractionIds.size > 0;
    case 'delete-person':
      return flags.personRemoved;
    case 'service-enabled':
      return flags.serviceEnabledFired;
    case 'interactions-logged':
      return flags.tutorialInteractionCount >= (step.requiredInteractions ?? 2);
    case 'wake-session-ended':
      return flags.wakeSessionEnded;
    default:
      return false;
  }
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { persons } = useService();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [removedInteractionIds, setRemovedInteractionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [conversationRemoved, setConversationRemoved] = useState(false);
  const [personRemoved, setPersonRemoved] = useState(false);
  const [tutorialInteractionCount, setTutorialInteractionCount] = useState(0);
  const [permissionsResolved, setPermissionsResolved] = useState(false);
  const [expandConversationDone, setExpandConversationDone] = useState(false);
  const [serviceEnabledFired, setServiceEnabledFired] = useState(false);
  const [wakeSessionEnded, setWakeSessionEnded] = useState(false);
  const [notificationsDismissed, setNotificationsDismissed] = useState(false);
  const [openSettingsForTutorial, setOpenSettingsForTutorial] = useState(false);

  const fixtures = useMemo(() => {
    const userPerson = persons.find(p => p.is_user);
    const anchorIso = userPerson?.created_at ?? new Date().toISOString();
    return buildTutorialFixtures(anchorIso);
  }, [persons]);

  const steps = STEPS;
  const step = steps[currentStepIndex] ?? steps[0];
  const totalSteps = steps.length;

  const actionFlags = useMemo(
    () => ({
      permissionsResolved,
      expandConversationDone,
      notificationsDismissed,
      removedInteractionIds,
      personRemoved,
      serviceEnabledFired,
      tutorialInteractionCount,
      wakeSessionEnded,
    }),
    [
      permissionsResolved,
      expandConversationDone,
      notificationsDismissed,
      removedInteractionIds,
      personRemoved,
      serviceEnabledFired,
      tutorialInteractionCount,
      wakeSessionEnded,
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
    if (step.id === 'layout_tour') {
      setNotificationsDismissed(false);
    }
  }, [currentStepIndex, step.id]);

  const next = useCallback(() => {
    setCurrentStepIndex(prev => {
      const current = steps[prev];
      if (current?.actionTrigger && !isStepActionComplete(current, actionFlags)) {
        return prev;
      }
      const nextIndex = Math.min(prev + 1, steps.length - 1);
      publishStep(nextIndex);
      return nextIndex;
    });
  }, [steps, actionFlags, publishStep]);

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
      if (trigger === 'expand-conversation') setExpandConversationDone(true);
      if (trigger === 'notifications-dismissed') setNotificationsDismissed(true);
      if (trigger === 'service-enabled') setServiceEnabledFired(true);
      if (trigger === 'wake-session-ended') setWakeSessionEnded(true);
      if (trigger === 'interactions-logged') {
        const required = steps[currentStepIndex]?.requiredInteractions ?? 2;
        setTutorialInteractionCount(required);
      }

      setCurrentStepIndex(prev => {
        const current = steps[prev];
        if (current?.actionTrigger !== trigger || !current.autoAdvanceOnAction) {
          return prev;
        }
        const nextIndex = Math.min(prev + 1, steps.length - 1);
        publishStep(nextIndex);
        return nextIndex;
      });
    },
    [steps, currentStepIndex, publishStep],
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
        current?.actionTrigger === 'interactions-logged' &&
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

  const micInteractive = currentStepIndex >= MIC_UNLOCK_STEP_INDEX;
  const wakeWordEnabled = currentStepIndex >= WAKE_UNLOCK_STEP_INDEX;
  const tutorialCommandMode = step.id === 'introduce_yourself' && !wakeSessionEnded;
  const showTestNotifications = step.id === 'layout_tour';
  const wakeHintVisible = step.id === 'introduce_yourself';

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
      isCurrentStepActionComplete,
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
      isCurrentStepActionComplete,
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
