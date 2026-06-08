import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@dadei/ui/lib/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/api/http/constants';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import {
  buildTutorialSteps,
  isMeetDadeiStep,
  isSettingsTutorialStep,
  meetDadeiStepIndex,
  TUTORIAL_STEP_EVENT,
} from '@dadei/ui/lib/tutorial/constants';
import { isTutorialTargetInteractive } from '@dadei/ui/lib/tutorial/clickGuard';
import {
  buildTutorialFixtures,
  isTutorialTestId,
} from '@dadei/ui/lib/tutorial/testData';
import type { ActionTrigger, TutorialStep } from '@dadei/ui/types/tutorial.types';
import type { Conversation, Interaction, Person } from '@dadei/ui/types/models.types';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
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
  const { isElectron } = useSystem();
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

  const steps = useMemo(() => buildTutorialSteps(isElectron), [isElectron]);
  const step = steps[currentStepIndex] ?? steps[0];
  const totalSteps = steps.length;
  const micUnlockStepIndex = useMemo(() => meetDadeiStepIndex(steps), [steps]);

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

  const micInteractive = currentStepIndex >= micUnlockStepIndex;
  const wakeWordEnabled = currentStepIndex >= micUnlockStepIndex;
  const tutorialCommandMode = isMeetDadeiStep(step.id) && !wakeSessionEnded;
  const showTestNotifications = step.id === 'layout_tour';
  const wakeHintVisible = isMeetDadeiStep(step.id) && !wakeSessionEnded;

  const value = useMemo<TutorialContextValue>(
    () => ({
      isActive: !wakeSessionEnded,
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

/** Overlay orchestration: completion, scroll-into-view, settings sync. Requires TutorialProvider. */
export function useTutorial() {
  const ctx = useTutorialContext();
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }

  const queryClient = useQueryClient();
  const introCompleteRef = useRef(false);

  const scrollTargetIntoView = useCallback((targetKey: string | null) => {
    if (!targetKey) return;
    const el = document.querySelector(`[data-tutorial-target="${targetKey}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const completeTutorial = useCallback(async () => {
    await api.post(ENDPOINTS.TUTORIAL_COMPLETE);
    await queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
  }, [queryClient]);

  const markActionFired = useCallback(
    (trigger: ActionTrigger) => {
      ctx.markActionFired(trigger);
      if (trigger === 'wake-session-ended') {
        if (introCompleteRef.current) return;
        introCompleteRef.current = true;
        void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
        void completeTutorial();
      }
    },
    [ctx, completeTutorial, queryClient],
  );

  useEffect(() => {
    scrollTargetIntoView(ctx.step.targetKey);
    if (isSettingsTutorialStep(ctx.step.id)) {
      ctx.setOpenSettingsForTutorial(true);
    } else if (ctx.openSettingsForTutorial) {
      ctx.setOpenSettingsForTutorial(false);
    }
  }, [ctx, scrollTargetIntoView]);

  useEffect(() => {
    const onSessionEnd = () => {
      markActionFired('wake-session-ended');
    };
    window.addEventListener('tutorial-wake-session-ended', onSessionEnd);
    return () => window.removeEventListener('tutorial-wake-session-ended', onSessionEnd);
  }, [markActionFired]);

  return {
    ...ctx,
    markActionFired,
    completeTutorial,
  };
}

export function useTutorialTargetInteractive(targetKey: string | null | undefined): boolean {
  const tutorial = useTutorialContext();
  if (!tutorial?.isActive) return true;
  return isTutorialTargetInteractive(targetKey, tutorial.step);
}

/** Non-target UI (e.g. panel chrome buttons) during action steps. */
export function useTutorialChromeInteractive(): boolean {
  const tutorial = useTutorialContext();
  if (!tutorial?.isActive) return true;
  return tutorial.step.kind !== 'action';
}
