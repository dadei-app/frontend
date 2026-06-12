import type { TutorialStep } from '@dadei/ui/types/tutorial.types';
import { TUTORIAL_INTERACTION_TARGET_KEYS } from '@dadei/ui/lib/tutorial/testData';

function settingsSections(isElectron: boolean): { id: string; title: string; body: string }[] {
  return [
    {
      id: 'integrations',
      title: 'Integrations',
      body: 'Logging in with Google connects dadei to your workspace. It will have access to your calendar, emails, and other data sources to act on your behalf.',
    },
    {
      id: 'memories',
      title: 'Memories',
      body: 'Everything dadei has learned about you, plus incomplete plans and floated ideas, not yet complete.',
    },
    {
      id: 'account',
      title: 'Account',
      body: 'This is your account information, set your timezone, network name, and login details here.',
    },
    {
      id: 'audio',
      title: 'Audio',
      body: 'This is your audio settings, select your microphone, apply noise suppression, and set the assistant hotkey here.',
    },
    ...(isElectron
      ? [
          {
            id: 'startup',
            title: 'Startup',
            body: 'This is your startup settings, this determines how your device behaves when at starts up.',
          },
        ]
      : []),
    {
      id: 'subscription',
      title: 'Subscription',
      body: 'This is your subscription information, coming soon...',
    },
    ...(isElectron
      ? [
          {
            id: 'about',
            title: 'About',
            body: 'This is your about information, it shows the app version, updates, and legal links here.',
          },
        ]
      : []),
  ];
}

const CORE_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Meet dadei',
    body: "I'm an ambient assistant — I listen in the background, remember what matters, and help when you ask. The next couple of minutes will get you set up.",
    targetKey: null,
  },
  {
    id: 'expand_conversation',
    title: 'Conversations',
    body: 'Everything I hear gets grouped into conversations. Click the conversation in the panel to open it up.',
    targetKey: 'tutorial-test-conversation',
    actionTriggers: ['expand-conversation'],
    autoAdvanceOnAction: true,
    interactables: ['tutorial-test-conversation'],
    backdropBlurPx: 0,
  },
  {
    id: 'delete_interaction',
    title: 'Interactions',
    body: 'Each conversation is composed of singular sentence interactions, hover over them to delete them.',
    targetKey: 'tutorial-test-interaction-1',
    cardAnchorKey: 'interaction-panel-root',
    cardPlacement: 'left',
    actionTriggers: ['delete-interaction'],
    interactables: [...TUTORIAL_INTERACTION_TARGET_KEYS],
    backdropBlurPx: 0,
  },
  {
    id: 'layout_tour',
    title: 'Notifications',
    body: "When I want to do something on your behalf, you'll see it here. Let the banner countdown delete the test conversation — or click Cancel and delete the conversation yourself from the panel.",
    targetKey: 'tutorial-delete-conversation-banner',
    cardAnchorKey: 'interaction-panel-root',
    cardPlacement: 'left',
    actionTriggers: ['delete-conversation'],
    interactables: [
      'tutorial-delete-conversation-banner',
      'tutorial-test-conversation',
    ],
    backdropBlurPx: 0,
  },
  {
    id: 'delete_person',
    title: 'Persons',
    body: "I learn to recognize voices over time and list everyone I've heard here. Delete me to clean house.",
    targetKey: 'tutorial-test-person',
    cardAnchorKey: 'persons-panel-root',
    cardPlacement: 'left',
    actionTriggers: ['delete-person'],
    openPersonsPanel: true,
    interactables: ['tutorial-test-person'],
    backdropBlurPx: 0,
  },
  {
    id: 'settings_walkthrough',
    title: 'Settings',
    body: "Everything you can tune lives here — integrations, what I remember, your account, audio, and more. Quick tour now so you know where to come back to.",
    targetKey: 'settings-panel-root',
  },
  {
    id: 'finish_tutorial',
    title: "You're all set",
    body: "That's the tour. I'll say hello and ask you to spell your name — listen and follow along.",
    targetKey: 'mic-button',
    cardAnchorKey: 'mic-button',
    cardPlacement: 'above',
    backdropBlurPx: 0,
    cardBackdropBlurPx: 0,
    startsIntroduction: true,
  },
];

export const TUTORIAL_FINISH_STEP_ID = 'finish_tutorial';

export function adjacentTutorialStepIndex(
  steps: TutorialStep[],
  index: number,
  delta: -1 | 1,
): number {
  const next = index + delta;
  return Math.max(0, Math.min(next, steps.length - 1));
}

export function isFinishTutorialStep(stepId: string): boolean {
  return stepId === TUTORIAL_FINISH_STEP_ID;
}

export function isSettingsTutorialStep(stepId: string): boolean {
  return stepId === 'settings_intro' || stepId.startsWith('settings_');
}

export const DEFAULT_BACKDROP_BLUR = 12;

export function backdropBlurForStep(step: TutorialStep): number {
  if (step.backdropBlurPx !== undefined) return step.backdropBlurPx;
  return DEFAULT_BACKDROP_BLUR;
}

function settingsSubSteps(isElectron: boolean): TutorialStep[] {
  const intro: TutorialStep = {
    id: 'settings_intro',
    title: 'Settings',
    body: 'Everything you can configure lives here. Use the arrows to walk through each section.',
    targetKey: 'settings-panel-root',
  };
  const sections = settingsSections(isElectron).map(section => ({
    id: `settings_${section.id}`,
    title: section.title,
    body: section.body,
    targetKey: `settings-section-${section.id}`,
  }));
  return [intro, ...sections];
}

/** Full step list with settings_walkthrough expanded into in-panel tour steps. */
export function buildTutorialSteps(isElectron: boolean): TutorialStep[] {
  const settingsIndex = CORE_STEPS.findIndex(s => s.id === 'settings_walkthrough');
  if (settingsIndex < 0) return CORE_STEPS;
  const before = CORE_STEPS.slice(0, settingsIndex);
  const after = CORE_STEPS.slice(settingsIndex + 1);
  return [...before, ...settingsSubSteps(isElectron), ...after];
}

export const TUTORIAL_STEP_EVENT = 'tutorial-step';

/** Keep the sample conversation collapsed so the user can expand it. */
export const TUTORIAL_COLLAPSE_CONVERSATION_STEP_IDS = new Set(['expand_conversation']);

/** Keep the sample conversation open so interactions are reachable. */
export const TUTORIAL_FORCE_EXPAND_CONVERSATION_STEP_IDS = new Set(['delete_interaction']);

/** Tutorial steps where the sample conversation may be deleted from the panel. */
export const TUTORIAL_CONVERSATION_DELETE_STEP_IDS = new Set(['layout_tour']);

/** Tutorial steps where sample interactions may be deleted from the panel. */
export const TUTORIAL_INTERACTION_DELETE_STEP_IDS = new Set(['delete_interaction']);

export function isTutorialInteractionDeleteStep(stepId: string): boolean {
  return TUTORIAL_INTERACTION_DELETE_STEP_IDS.has(stepId);
}

export function isTutorialConversationDeleteStep(stepId: string): boolean {
  return TUTORIAL_CONVERSATION_DELETE_STEP_IDS.has(stepId);
}

export const TUTORIAL_TEST_BANNER_TITLE = 'Delete test conversation';
export const TUTORIAL_TEST_BANNER_ID = 'tutorial-delete-conversation-banner';
