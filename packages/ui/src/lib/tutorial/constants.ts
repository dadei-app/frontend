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
    kind: 'spotlight',
    title: 'Meet dadei',
    body: "I'm an ambient assistant — I listen in the background, remember what matters, and help when you ask. The next couple of minutes will get you set up.",
    targetKey: null,
  },
  {
    id: 'permissions',
    kind: 'spotlight',
    title: 'A few permissions',
    body: "I need access to your microphone and a couple of system services to actually do my job. Grant what you're comfortable with — anything you skip, you can turn on later in Settings.",
    targetKey: null,
    actionTrigger: 'permission-resolved',
  },
  {
    id: 'expand_conversation',
    kind: 'action',
    title: 'Conversations',
    body: 'Everything I hear gets grouped into conversations. Click the conversation in the panel to open it up.',
    targetKey: 'tutorial-test-conversation',
    actionTrigger: 'expand-conversation',
    autoAdvanceOnAction: true,
    allowedClickTargets: ['tutorial-test-conversation'],
  },
  {
    id: 'delete_interaction',
    kind: 'action',
    title: 'Interactions',
    body: 'I break each conversation into interactions — one sentence, one person at a time. Hover the first one and click the trash icon to delete it.',
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
    body: "When I want to do something on your behalf, you'll see it here. Banners have a 10 second dismissal countdown.",
    targetKey: 'assistant-layout-shell',
    actionTrigger: 'notifications-dismissed',
    allowedClickTargets: ['tutorial-delete-conversation-banner'],
  },
  {
    id: 'delete_person',
    kind: 'action',
    title: 'Persons',
    body: "I learn to recognize voices over time and list everyone I've heard here. Delete me to clean house.",
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
    body: "Everything you can tune lives here — integrations, what I remember, your account, audio, and more. Quick tour now so you know where to come back to.",
    targetKey: 'settings-panel-root',
  },
  {
    id: 'how_dadei_works',
    kind: 'spotlight',
    title: 'How dadei works',
    body: 'Turn me on and every device on your network starts listening together. I run quietly in the background.',
    targetKey: 'mic-button',
    cardAnchorKey: 'mic-button',
    cardPlacement: 'above',
    backdropBlurPx: 4,
  },
  {
    id: 'meet_dadei',
    kind: 'action',
    title: 'Say hello',
    body: "I'll say hello first — when I'm done, tell me about yourself and spell your name out letter by letter.",
    targetKey: 'mic-button',
    cardAnchorKey: 'mic-button',
    cardPlacement: 'above',
    actionTrigger: 'wake-session-ended',
    backdropBlurPx: 0,
    allowedClickTargets: ['mic-button'],
  },
];

/** Sent to the tutorial introduction endpoint to start the canned opener turn. */
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

function settingsSubSteps(isElectron: boolean): TutorialStep[] {
  const intro: TutorialStep = {
    id: 'settings_intro',
    kind: 'spotlight',
    title: 'Settings',
    body: 'Everything you can configure lives here. Use the arrows to walk through each section.',
    targetKey: 'settings-panel-root',
  };
  const sections = settingsSections(isElectron).map(section => ({
    id: `settings_${section.id}`,
    kind: 'spotlight' as const,
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

export function meetDadeiStepIndex(steps: TutorialStep[]): number {
  return steps.findIndex(s => s.id === TUTORIAL_MEET_DADEI_STEP_ID);
}

export const TUTORIAL_STEP_EVENT = 'tutorial-step';

/** Keep the sample conversation collapsed so the user can expand it. */
export const TUTORIAL_COLLAPSE_CONVERSATION_STEP_IDS = new Set(['expand_conversation']);

/** Keep the sample conversation open so interactions are reachable. */
export const TUTORIAL_FORCE_EXPAND_CONVERSATION_STEP_IDS = new Set(['delete_interaction']);

export const TUTORIAL_TEST_BANNER_TITLE = 'Delete test conversation';
export const TUTORIAL_TEST_BANNER_ID = 'tutorial-delete-conversation-banner';
