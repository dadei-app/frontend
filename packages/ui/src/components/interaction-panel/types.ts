import type { Conversation, Interaction } from '@dadei/ui/types/models.types';

export interface ConversationGroupState {
  conversation: Conversation | null;
  interactions: Interaction[];
  /** When set, user has toggled expand/collapse; otherwise UI derives from active conversation */
  isExpanded?: boolean;
}

export interface ConversationGroupView extends ConversationGroupState {
  isActive: boolean;
  isExpanded: boolean;
}

