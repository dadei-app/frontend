import type { Conversation, Interaction, Person } from '@dadei/ui/types/models.types';

export const TEST_PERSON: Person = {
  id: 'tutorial-test-person',
  name: 'Tutorial Demo',
  is_user: false,
  network_id: 'tutorial',
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export const TEST_CONVERSATION: Conversation = {
  id: 'tutorial-test-conversation',
  started_at: new Date(0).toISOString(),
  topic_summary: 'Tutorial demo',
  context_summary: null,
  is_active: false,
};

export const TEST_INTERACTIONS: Interaction[] = [
  {
    id: 'tutorial-test-interaction-1',
    text: 'Hey, this is Dadei.',
    timestamp: new Date(0).toISOString(),
    network_id: 'tutorial',
    person_id: 'tutorial-test-person',
    conversation_id: 'tutorial-test-conversation',
    sentiment: null,
  },
  {
    id: 'tutorial-test-interaction-2',
    text: 'This is an interaction.',
    timestamp: new Date(1000).toISOString(),
    network_id: 'tutorial',
    person_id: 'tutorial-test-person',
    conversation_id: 'tutorial-test-conversation',
    sentiment: null,
  },
  {
    id: 'tutorial-test-interaction-3',
    text: 'Interactions are single sentence statements.',
    timestamp: new Date(2000).toISOString(),
    network_id: 'tutorial',
    person_id: 'tutorial-test-person',
    conversation_id: 'tutorial-test-conversation',
    sentiment: null,
  },
  {
    id: 'tutorial-test-interaction-4',
    text: 'We all fit into a conversation.',
    timestamp: new Date(3000).toISOString(),
    network_id: 'tutorial',
    person_id: 'tutorial-test-person',
    conversation_id: 'tutorial-test-conversation',
    sentiment: null,
  },
];

export function isTutorialTestId(id: string): boolean {
  return id.startsWith('tutorial-test-');
}
