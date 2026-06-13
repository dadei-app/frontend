import type { QueryClient } from '@tanstack/react-query';
import { INTERACTION_PANEL_RECENT_LIMIT } from '@dadei/ui/lib/platform/query/constants';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';
import type { Conversation, Interaction } from '@dadei/ui/types/models.types';

export function removeAllConversationQueries(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: queryKeys.conversations });
}

/** Update all interaction list caches (bootstrap + flat list) in one pass. */
export function patchInteractionCaches(
  queryClient: QueryClient,
  updater: (prev: Interaction[] | undefined) => Interaction[] | undefined,
) {
  queryClient.setQueriesData<Interaction[]>(
    { queryKey: [...queryKeys.interactions, 'bootstrap'] },
    updater,
  );
  queryClient.setQueryData<Interaction[]>(queryKeys.interactions, updater);
}

function getAllCachedInteractions(queryClient: QueryClient): Interaction[] {
  const seen = new Set<string>();
  const out: Interaction[] = [];
  for (const [, data] of queryClient.getQueriesData<Interaction[]>({
    queryKey: queryKeys.interactions,
  })) {
    for (const interaction of data ?? []) {
      if (seen.has(interaction.id)) continue;
      seen.add(interaction.id);
      out.push(interaction);
    }
  }
  return out;
}

function conversationHasRemainingInteractions(
  queryClient: QueryClient,
  conversationId: string,
): boolean {
  for (const [, data] of queryClient.getQueriesData<Interaction[]>({
    queryKey: queryKeys.interactions,
  })) {
    if (data?.some(i => (i.conversation_id?.trim() ?? '') === conversationId)) {
      return true;
    }
  }
  return false;
}

/**
 * Mirror backend person delete: drop their interactions from cache and remove conversations
 * that no longer have any cached interactions (backend deletes empty conversations too).
 */
export function removePersonFromCaches(
  queryClient: QueryClient,
  personId: string,
  onEmptyConversation?: (conversationId: string) => void,
) {
  const affectedConvIds = new Set<string>();
  for (const interaction of getAllCachedInteractions(queryClient)) {
    if (interaction.person_id !== personId) continue;
    const cid = interaction.conversation_id?.trim();
    if (cid) affectedConvIds.add(cid);
  }

  patchInteractionCaches(queryClient, prev =>
    (prev ?? []).filter(i => i.person_id !== personId),
  );

  for (const cid of affectedConvIds) {
    if (conversationHasRemainingInteractions(queryClient, cid)) continue;
    onEmptyConversation?.(cid);
    queryClient.removeQueries({ queryKey: queryKeys.conversationById(cid) });
    queryClient.setQueryData<Conversation[]>(
      queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
      prev => (prev ?? []).filter(c => c.id !== cid),
    );
  }
}

/**
 * Drop cached network-scoped data (conversations, interactions, memory, actions, persons, service).
 * Call on logout or when auth is cleared so a new session never reads stale rows.
 */
export function clearAssistantSessionCaches(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: queryKeys.memories });
  queryClient.removeQueries({ queryKey: queryKeys.actions });
  removeAllConversationQueries(queryClient);
  queryClient.removeQueries({ queryKey: queryKeys.interactions });
  queryClient.removeQueries({ queryKey: queryKeys.persons });
}
