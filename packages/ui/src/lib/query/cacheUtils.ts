import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';

export function removeAllConversationQueries(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: queryKeys.conversations });
}

/**
 * Drop cached network-scoped data (conversations, interactions, memory, actions, persons, service).
 * Call on logout or when auth is cleared so a new session never reads stale rows.
 */
export function clearAssistantSessionCaches(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: queryKeys.serviceClients });
  queryClient.removeQueries({ queryKey: queryKeys.memories });
  queryClient.removeQueries({ queryKey: queryKeys.actions });
  removeAllConversationQueries(queryClient);
  queryClient.removeQueries({ queryKey: queryKeys.interactions });
  queryClient.removeQueries({ queryKey: queryKeys.persons });
}
