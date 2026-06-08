import type { Conversation, Interaction, Person } from '@dadei/ui/types/models.types';
import { parseApiDateTime } from '@dadei/ui/lib/shared/parseApiDateTime';
import { formatForUser } from '@dadei/ui/utils/time';

export const TUTORIAL_TEST_PERSON_ID = 'tutorial-test-person';
export const TUTORIAL_TEST_CONVERSATION_ID = 'tutorial-test-conversation';

export const TUTORIAL_INTERACTION_TARGET_KEYS = [
  'tutorial-test-interaction-1',
  'tutorial-test-interaction-2',
  'tutorial-test-interaction-3',
  'tutorial-test-interaction-4',
] as const;

export const TUTORIAL_INTERACTION_COUNT = TUTORIAL_INTERACTION_TARGET_KEYS.length;

export interface TutorialFixtures {
  person: Person;
  conversation: Conversation;
  interactions: Interaction[];
}

function formatAnchorLabel(iso: string): string {
  const d = parseApiDateTime(iso);
  if (Number.isNaN(d.getTime())) return 'your first session';
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return formatForUser(d.toISOString(), userTz, { dateStyle: 'medium', timeStyle: 'short' });
}

function isoAt(anchorIso: string, offsetMs: number): string {
  const base = parseApiDateTime(anchorIso).getTime();
  if (Number.isNaN(base)) return new Date(offsetMs).toISOString();
  return new Date(base + offsetMs).toISOString();
}

/** Demo person, conversation, and interactions anchored to account / user creation time. */
export function buildTutorialFixtures(anchorIso: string): TutorialFixtures {
  const whenLabel = formatAnchorLabel(anchorIso);

  return {
    person: {
      id: TUTORIAL_TEST_PERSON_ID,
      name: 'dadei',
      is_user: false,
      network_id: 'tutorial',
      created_at: anchorIso,
      updated_at: anchorIso,
    },
    conversation: {
      id: TUTORIAL_TEST_CONVERSATION_ID,
      started_at: anchorIso,
      topic_summary: 'Getting started with dadei',
      context_summary: `Sample conversation from ${whenLabel}. Interactions like these are grouped together so you can review what happened at a glance.`,
      is_active: false,
    },
    interactions: [
      {
        id: 'tutorial-test-interaction-1',
        text: 'Hey, this is dadei.',
        timestamp: isoAt(anchorIso, 30_000),
        network_id: 'tutorial',
        person_id: TUTORIAL_TEST_PERSON_ID,
        conversation_id: TUTORIAL_TEST_CONVERSATION_ID,
        sentiment: null,
      },
      {
        id: 'tutorial-test-interaction-2',
        text: 'Each line you see is one interaction.',
        timestamp: isoAt(anchorIso, 90_000),
        network_id: 'tutorial',
        person_id: TUTORIAL_TEST_PERSON_ID,
        conversation_id: TUTORIAL_TEST_CONVERSATION_ID,
        sentiment: null,
      },
      {
        id: 'tutorial-test-interaction-3',
        text: 'Interactions are short, single-sentence statements.',
        timestamp: isoAt(anchorIso, 150_000),
        network_id: 'tutorial',
        person_id: TUTORIAL_TEST_PERSON_ID,
        conversation_id: TUTORIAL_TEST_CONVERSATION_ID,
        sentiment: null,
      },
      {
        id: 'tutorial-test-interaction-4',
        text: 'They roll up into conversations like this one.',
        timestamp: isoAt(anchorIso, 210_000),
        network_id: 'tutorial',
        person_id: TUTORIAL_TEST_PERSON_ID,
        conversation_id: TUTORIAL_TEST_CONVERSATION_ID,
        sentiment: null,
      },
    ],
  };
}

export function isTutorialTestId(id: string): boolean {
  return id.startsWith('tutorial-test-');
}
