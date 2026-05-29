export const queryKeys = {
  persons: ['persons'] as const,
  personById: (personId: string) => ['persons', personId] as const,
  /** Prefix for memory list queries; use with `removeQueries` / `invalidateQueries`. */
  memories: ['memories'] as const,
  memoriesList: (limit: number) => [...queryKeys.memories, 'list', limit] as const,
  /** Prefix for action list queries. */
  actions: ['actions'] as const,
  actionsList: (limit: number, offset: number, actionType?: string) =>
    [...queryKeys.actions, 'list', limit, offset, actionType ?? 'all'] as const,
  interactions: ['interactions'] as const,
  /** Prefix for `conversationById`; use with `removeQueries` / `invalidateQueries` to affect all cached conversations. */
  conversations: ['conversations'] as const,
  conversationsRecent: (limit: number) => [...queryKeys.conversations, 'recent', limit] as const,
  /** Bootstrap interactions scoped to conversation IDs (sorted, joined for stable key). */
  interactionsBootstrap: (conversationIdsKey: string) =>
    [...queryKeys.interactions, 'bootstrap', conversationIdsKey] as const,
  conversationById: (conversationId: string) =>
    [...queryKeys.conversations, conversationId] as readonly ['conversations', string],
  serviceClients: ['service', 'clients'] as const,
  authMe: ['auth', 'me'] as const,
  integrationsStatus: ['integrations', 'status'] as const,
};
