import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';
import type { TutorialStep } from './types';
import { detectPlatform } from './permissionsRegistry';
import { TUTORIAL_INTERACTION_TARGET_KEYS } from './testData';

const SETTINGS_SECTIONS: { id: string; title: string; body: string }[] = [
  {
    id: 'integrations',
    title: 'Integrations',
    body: 'Connect Google Workspace and realtime data sources.',
  },
  {
    id: 'memories',
    title: 'Memories',
    body: 'Facts Dadei remembers and proposed memories awaiting approval.',
  },
  {
    id: 'account',
    title: 'Account',
    body: 'Timezone, network name, email, password, and session actions.',
  },
  {
    id: 'audio',
    title: 'Audio',
    body: 'Microphone, noise suppression, assistant hotkey, and input level.',
  },
  ...(isElectronDesktop()
    ? [
        {
          id: 'startup',
          title: 'Startup',
          body: 'Launch at login, window behavior, and desktop permissions.',
        },
      ]
    : []),
  {
    id: 'subscription',
    title: 'Subscription',
    body: 'Plans and billing when subscriptions launch.',
  },
  ...(isElectronDesktop()
    ? [
        {
          id: 'about',
          title: 'About',
          body: 'App version, updates, and legal links.',
        },
      ]
    : []),
];

const CORE_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    kind: 'spotlight',
    title: 'Meet Dadei',
    body: "An ambient assistant that listens, remembers, and helps when you ask. Let's take two minutes to set things up.",
    targetKey: null,
  },
  {
    id: 'permissions',
    kind: 'spotlight',
    title: 'Permissions',
    body: "Dadei needs a few permissions to work. Grant what you're comfortable with — you can skip any of them.",
    targetKey: null,
    actionTrigger: 'permission-resolved',
  },
  {
    id: 'expand_conversation',
    kind: 'action',
    title: 'Conversations',
    body: 'Interactions group into conversations. Click the sample conversation in the panel to expand it.',
    targetKey: 'tutorial-test-conversation',
    actionTrigger: 'expand-conversation',
    autoAdvanceOnAction: true,
    allowedClickTargets: ['tutorial-test-conversation'],
  },
  {
    id: 'delete_interaction',
    kind: 'action',
    title: 'Interactions',
    body: 'Each line is one interaction. Hover the first one and click the trash icon to delete it.',
    targetKey: 'tutorial-test-interaction-1',
    cardAnchorKey: 'interaction-panel-root',
    cardPlacement: 'left',
    actionTrigger: 'delete-interaction',
    allowedClickTargets: [...TUTORIAL_INTERACTION_TARGET_KEYS],
  },
  {
    id: 'layout_tour',
    kind: 'action',
    title: 'Your space',
    body: 'Dismiss the toast. The banner proposes deleting the test conversation — Cancel keeps it, or let the countdown finish to remove it.',
    targetKey: 'assistant-layout-shell',
    actionTrigger: 'notifications-dismissed',
    allowedClickTargets: ['tutorial-test-toast', 'tutorial-delete-conversation-banner'],
  },
  {
    id: 'delete_person',
    kind: 'action',
    title: 'Persons',
    body: 'Dadei recognizes voices over time. Delete the demo person named dadei shown here.',
    targetKey: 'tutorial-test-person',
    cardAnchorKey: 'persons-panel-root',
    cardPlacement: 'left',
    actionTrigger: 'delete-person',
    openPersonsPanel: true,
    allowedClickTargets: ['tutorial-test-person'],
  },
  {
    id: 'settings_walkthrough',
    kind: 'spotlight',
    title: 'Settings',
    body: 'A quick tour of your settings.',
    targetKey: 'settings-panel-root',
  },
  {
    id: 'how_dadei_works',
    kind: 'spotlight',
    title: 'How does Dadei work?',
    body: 'When you enable Dadei, listening turns on across every device on your network. Say "hey Dadei" anytime to start a conversation.',
    targetKey: 'mic-button',
    cardAnchorKey: 'mic-button',
    cardPlacement: 'below',
    backdropBlurPx: 4,
  },
  {
    id: 'introduce_yourself',
    kind: 'action',
    title: 'Introduce yourself',
    body: 'Dadei is listening — say hello and share your name. This is how Dadei learns who you are and recognizes your voice.',
    targetKey: 'mic-button',
    cardAnchorKey: 'mic-button',
    cardPlacement: 'below',
    actionTrigger: 'wake-session-ended',
    backdropBlurPx: 0,
    allowedClickTargets: ['mic-button'],
  },
];

export function isSettingsTutorialStep(stepId: string): boolean {
  return stepId === 'settings_intro' || stepId.startsWith('settings_');
}

export const DEFAULT_SPOTLIGHT_BACKDROP_BLUR = 12;
export const DEFAULT_ACTION_BACKDROP_BLUR = 0;

export function backdropBlurForStep(step: TutorialStep): number {
  if (step.backdropBlurPx !== undefined) return step.backdropBlurPx;
  return step.kind === 'action' ? DEFAULT_ACTION_BACKDROP_BLUR : DEFAULT_SPOTLIGHT_BACKDROP_BLUR;
}

function settingsSubSteps(): TutorialStep[] {
  const intro: TutorialStep = {
    id: 'settings_intro',
    kind: 'spotlight',
    title: 'Settings',
    body: 'Everything you can configure lives here. Use the arrows to walk through each section.',
    targetKey: 'settings-panel-root',
  };
  const sections = SETTINGS_SECTIONS.map(section => ({
    id: `settings_${section.id}`,
    kind: 'spotlight' as const,
    title: section.title,
    body: section.body,
    targetKey: `settings-section-${section.id}`,
  }));
  return [intro, ...sections];
}

/** Full step list with settings_walkthrough expanded into in-panel tour steps. */
export function buildTutorialSteps(): TutorialStep[] {
  const settingsIndex = CORE_STEPS.findIndex(s => s.id === 'settings_walkthrough');
  if (settingsIndex < 0) return CORE_STEPS;
  const before = CORE_STEPS.slice(0, settingsIndex);
  const after = CORE_STEPS.slice(settingsIndex + 1);
  return [...before, ...settingsSubSteps(), ...after];
}

export const STEPS = buildTutorialSteps();

export const TUTORIAL_PLATFORM = detectPlatform();

/** Step index where mic becomes interactive (introduce_yourself). */
export const MIC_UNLOCK_STEP_INDEX = STEPS.findIndex(s => s.id === 'introduce_yourself');

/** Step index where voice command / introduction mode is enabled (introduce_yourself). */
export const WAKE_UNLOCK_STEP_INDEX = STEPS.findIndex(s => s.id === 'introduce_yourself');

export const TUTORIAL_STEP_EVENT = 'tutorial-step';

/** Keep the sample conversation collapsed so the user can expand it. */
export const TUTORIAL_COLLAPSE_CONVERSATION_STEP_IDS = new Set(['expand_conversation']);

/** Keep the sample conversation open so interactions are reachable. */
export const TUTORIAL_FORCE_EXPAND_CONVERSATION_STEP_IDS = new Set(['delete_interaction']);

export const TUTORIAL_TEST_TOAST_MESSAGE = 'Test notification — this is what alerts look like.';
export const TUTORIAL_TEST_BANNER_TITLE = 'Delete test conversation';
export const TUTORIAL_TEST_BANNER_ID = 'tutorial-delete-conversation-banner';
