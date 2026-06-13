import type { Interaction } from '@dadei/ui/types/models.types';

export function sampleInteraction(overrides: Partial<Interaction> = {}): Interaction {
  return {
    id: 'int-1',
    network_id: 'net-1',
    person_id: 'person-1',
    conversation_id: 'conv-1',
    text: 'Hello from the interaction panel',
    timestamp: '2025-06-12T14:00:00Z',
    sentiment: null,
    ...overrides,
  };
}
