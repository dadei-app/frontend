import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';
import type { TutorialStep } from './types';
import { detectPlatform } from './permissionsRegistry';

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
    id: 'layout_tour',
    kind: 'spotlight',
    title: 'Your space',
    body: 'This is where Dadei lives. Notifications appear here as toasts, and pending actions show up as banners you can cancel.',
    targetKey: 'assistant-layout-shell',
  },
  {
    id: 'interactions_panel',
    kind: 'action',
    title: 'Interactions',
    body: 'Each line is one interaction. Click the highlighted one to continue.',
    targetKey: 'tutorial-test-interaction-2',
    actionTrigger: 'click',
  },
  {
    id: 'delete_interaction',
    kind: 'action',
    title: 'Delete an interaction',
    body: 'Hover any single interaction and click the trash icon. Try it on the first one.',
    targetKey: 'tutorial-test-interaction-1',
    actionTrigger: 'delete-interaction',
  },
  {
    id: 'delete_conversation',
    kind: 'action',
    title: 'Delete the conversation',
    body: 'You can also delete an entire conversation at once. Try it on the test conversation.',
    targetKey: 'tutorial-test-conversation',
    actionTrigger: 'delete-conversation',
  },
  {
    id: 'persons_panel',
    kind: 'spotlight',
    title: 'People',
    body: 'Dadei recognizes voices over time. You can rename anyone here, or delete them and their interactions.',
    targetKey: 'people-panel-root',
  },
  {
    id: 'delete_person',
    kind: 'action',
    title: 'Delete the test person',
    body: 'Click the trash icon on the test person to remove them.',
    targetKey: 'tutorial-test-person',
    actionTrigger: 'delete-person',
  },
  {
    id: 'settings_walkthrough',
    kind: 'spotlight',
    title: 'Settings',
    body: 'A quick tour of your settings.',
    targetKey: 'settings-panel-root',
  },
  {
    id: 'enable_service',
    kind: 'action',
    title: 'Turn on Dadei',
    body: 'Click the microphone to enable passive listening.',
    targetKey: 'mic-button',
    actionTrigger: 'service-enabled',
  },
  {
    id: 'passive_demo',
    kind: 'action',
    title: 'Try talking',
    body: 'Say a few things. Watch them appear in the interactions panel.',
    targetKey: 'interaction-panel-root',
    actionTrigger: 'interactions-logged',
    requiredInteractions: 2,
  },
  {
    id: 'wake_word_demo',
    kind: 'action',
    title: 'Now say "hey Dadei"',
    body: 'Wake Dadei up and have a quick chat. Dadei will end the conversation when ready.',
    targetKey: 'mic-button',
    actionTrigger: 'wake-session-ended',
  },
];

function settingsSubSteps(): TutorialStep[] {
  return SETTINGS_SECTIONS.map(section => ({
    id: `settings_${section.id}`,
    kind: 'spotlight' as const,
    title: section.title,
    body: section.body,
    targetKey: `settings-section-${section.id}`,
  }));
}

/** Full step list with settings_walkthrough expanded into per-section spotlights. */
export function buildTutorialSteps(): TutorialStep[] {
  const settingsIndex = CORE_STEPS.findIndex(s => s.id === 'settings_walkthrough');
  if (settingsIndex < 0) return CORE_STEPS;
  const before = CORE_STEPS.slice(0, settingsIndex);
  const after = CORE_STEPS.slice(settingsIndex + 1);
  const subs = settingsSubSteps();
  if (subs.length > 0) {
    subs[0] = { ...subs[0], targetKey: 'settings-panel-root' };
  }
  return [...before, ...subs, ...after];
}

export const STEPS = buildTutorialSteps();

export const TUTORIAL_PLATFORM = detectPlatform();

/** Step index where mic becomes interactive (enable_service). */
export const MIC_UNLOCK_STEP_INDEX = STEPS.findIndex(s => s.id === 'enable_service');

/** Step index where wake-word detection is enabled (wake_word_demo). */
export const WAKE_UNLOCK_STEP_INDEX = STEPS.findIndex(s => s.id === 'wake_word_demo');

export const TUTORIAL_STEP_EVENT = 'tutorial-step';
