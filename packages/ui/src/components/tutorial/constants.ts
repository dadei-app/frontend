import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';
import type { TutorialStep } from './types';
import { detectPlatform } from './permissionsRegistry';
import { TUTORIAL_INTERACTION_TARGET_KEYS } from './testData';

const SETTINGS_SECTIONS: { id: string; title: string; body: string }[] = [
  {
    id: 'integrations',
    title: 'Integrations',
    body: 'Connect Google Workspace and the realtime data sources Dadei uses to act on your behalf.',
  },
  {
    id: 'memories',
    title: 'Memories',
    body: 'Everything Dadei has learned about you, plus proposed memories waiting for your approval.',
  },
  {
    id: 'account',
    title: 'Account',
    body: 'Timezone, network name, email, password, and session actions.',
  },
  {
    id: 'audio',
    title: 'Audio',
    body: 'Microphone selection, noise suppression, the assistant hotkey, and your input level.',
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
    body: 'Your plan and billing details.',
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
    body: "Dadei is an ambient assistant — it listens in the background, remembers what matters, and helps when you ask. The next couple of minutes will get you set up.",
    targetKey: null,
  },
  {
    id: 'permissions',
    kind: 'spotlight',
    title: 'A few permissions',
    body: "Dadei needs access to your microphone and a couple of system services to actually do its job. Grant what you're comfortable with — anything you skip, you can turn on later in Settings.",
    targetKey: null,
    actionTrigger: 'permission-resolved',
  },
  {
    id: 'expand_conversation',
    kind: 'action',
    title: 'Conversations',
    body: 'Everything Dadei hears gets grouped into conversations — one per session of people talking. Click the sample conversation in the panel to open it up.',
    targetKey: 'tutorial-test-conversation',
    actionTrigger: 'expand-conversation',
    autoAdvanceOnAction: true,
    allowedClickTargets: ['tutorial-test-conversation'],
  },
  {
    id: 'delete_interaction',
    kind: 'action',
    title: 'Interactions',
    body: 'Inside a conversation, each line is a single interaction — one thing someone said. Hover the first one and click the trash icon to delete it.',
    targetKey: 'tutorial-test-interaction-1',
    cardAnchorKey: 'interaction-panel-root',
    cardPlacement: 'left',
    actionTrigger: 'delete-interaction',
    allowedClickTargets: [...TUTORIAL_INTERACTION_TARGET_KEYS],
  },
  {
    id: 'layout_tour',
    kind: 'action',
    title: 'Notifications',
    body: "When Dadei wants to do something on your behalf, you'll see it here. Dismiss the toast, then handle the banner — Cancel keeps the test conversation, or let the countdown run out to remove it.",
    targetKey: 'assistant-layout-shell',
    actionTrigger: 'notifications-dismissed',
    allowedClickTargets: ['tutorial-test-toast', 'tutorial-delete-conversation-banner'],
  },
  {
    id: 'delete_person',
    kind: 'action',
    title: 'Persons',
    body: "Dadei learns to recognize voices over time and lists everyone it's heard here. This one is just a placeholder named after the app — delete it to clean house.",
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
    body: "Everything you can tune lives here — integrations, what Dadei remembers, your account, audio, and more. Quick tour now so you know where to come back to.",
    targetKey: 'settings-panel-root',
  },
  {
    id: 'how_dadei_works',
    kind: 'spotlight',
    title: 'How Dadei works',
    body: 'Turn Dadei on and every device on your network starts listening together. It runs quietly in the background. To get its attention, say "hey Dadei" or press the mic button.',
    targetKey: 'mic-button',
    cardAnchorKey: 'mic-button',
    cardPlacement: 'below',
    backdropBlurPx: 4,
  },
  {
    id: 'meet_dadei',
    kind: 'action',
    title: 'Say hello',
    body: "Click the mic button to wake Dadei up. It'll introduce itself and ask a bit about you so it knows who it's working for. Take your time — the more you talk, the better it gets at recognizing your voice later.",
    targetKey: 'mic-button',
    cardAnchorKey: 'mic-button',
    cardPlacement: 'above',
    actionTrigger: 'wake-session-ended',
    backdropBlurPx: 0,
    allowedClickTargets: ['mic-button'],
  },
];

export const TUTORIAL_INTRO_KICKOFF_TEXT = '__dadei_tutorial_intro_kickoff__';

export const TUTORIAL_MEET_DADEI_STEP_ID = 'meet_dadei';

export function isMeetDadeiStep(stepId: string): boolean {
  return stepId === TUTORIAL_MEET_DADEI_STEP_ID;
}

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

/** Step index where mic becomes interactive (meet_dadei). */
export const MIC_UNLOCK_STEP_INDEX = STEPS.findIndex(s => s.id === TUTORIAL_MEET_DADEI_STEP_ID);

/** Step index where voice command / introduction mode is enabled (meet_dadei). */
export const WAKE_UNLOCK_STEP_INDEX = STEPS.findIndex(s => s.id === TUTORIAL_MEET_DADEI_STEP_ID);

export const TUTORIAL_STEP_EVENT = 'tutorial-step';

/** Keep the sample conversation collapsed so the user can expand it. */
export const TUTORIAL_COLLAPSE_CONVERSATION_STEP_IDS = new Set(['expand_conversation']);

/** Keep the sample conversation open so interactions are reachable. */
export const TUTORIAL_FORCE_EXPAND_CONVERSATION_STEP_IDS = new Set(['delete_interaction']);

export const TUTORIAL_TEST_TOAST_MESSAGE = 'Test notification — this is what alerts look like.';
export const TUTORIAL_TEST_BANNER_TITLE = 'Delete test conversation';
export const TUTORIAL_TEST_BANNER_ID = 'tutorial-delete-conversation-banner';
