import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { actionsApi } from '@dadei/ui/lib/api/actions';
import { memoriesApi } from '@dadei/ui/lib/api/memories';
import { personsApi } from '@dadei/ui/lib/api/persons';
import { interactionsApi } from '@dadei/ui/lib/api/interactions';
import { conversationsApi } from '@dadei/ui/lib/api/conversations';
import { authApi } from '@dadei/ui/lib/api/auth';
import type { Conversation, Person } from '@dadei/ui/types/models.types';
import type { UserMe } from '@dadei/ui/types/auth.types';
import { queryKeys } from '@dadei/ui/lib/queryKeys';

const CONVERSATION_STALE_MS = 5 * 60_000;
const INTERACTIONS_BOOTSTRAP_STALE_MS = 30_000;

/** Recent conversation page size for the interaction panel bootstrap. */
export const INTERACTION_PANEL_RECENT_LIMIT = 10;

/** Shared options so every code path (useQueries, prefetch, realtime) hits the same cache shape. */
export function conversationQueryOptions(conversationId: string) {
  return {
    queryKey: queryKeys.conversationById(conversationId),
    queryFn: (): Promise<Conversation> => conversationsApi.getById(conversationId),
    staleTime: CONVERSATION_STALE_MS,
    retry: (failureCount: number, error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 404) return false;
      return failureCount < 3;
    },
  };
}

export function removeAllConversationQueries(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: queryKeys.conversations });
}

/** Default list sizes for assistant shell + settings (matches interaction panel style scoped keys). */
export const ASSISTANT_MEMORIES_LIST_LIMIT = 100;
export const ASSISTANT_ACTIONS_LIST_LIMIT = 100;

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

export function usePersonsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.persons,
    queryFn: () => personsApi.getAll(),
    enabled,
  });
}

export function usePersonQuery(personId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.personById(personId ?? ''),
    queryFn: () => personsApi.getById(personId ?? ''),
    enabled: Boolean(personId) && enabled,
  });
}

export function useRenamePersonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, name }: { personId: string; name: string }) =>
      personsApi.update(personId, { name }),
    onMutate: async ({ personId, name }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.persons });
      const previous = queryClient.getQueryData<Person[]>(queryKeys.persons);
      if (previous) {
        queryClient.setQueryData<Person[]>(
          queryKeys.persons,
          previous.map(person => (person.id === personId ? { ...person, name } : person))
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.persons, context.previous);
      }
    },
    onSuccess: updatedPerson => {
      queryClient.setQueryData<Person[]>(queryKeys.persons, previous =>
        (previous ?? []).map(person => (person.id === updatedPerson.id ? updatedPerson : person))
      );
      queryClient.setQueryData(queryKeys.personById(updatedPerson.id), updatedPerson);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
    },
  });
}

export function useDeletePersonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) => personsApi.delete(personId),
    onSuccess: (_data, personId) => {
      queryClient.setQueryData<Person[]>(queryKeys.persons, previous =>
        (previous ?? []).filter(person => person.id !== personId)
      );
      queryClient.removeQueries({ queryKey: queryKeys.personById(personId) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
      void queryClient.invalidateQueries({ queryKey: queryKeys.interactions });
    },
  });
}

export function useInteractionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.interactions,
    queryFn: () => interactionsApi.getAll(),
    enabled,
  });
}

export function memoriesListQueryOptions(limit = ASSISTANT_MEMORIES_LIST_LIMIT) {
  return {
    queryKey: queryKeys.memoriesList(limit),
    queryFn: () => memoriesApi.list({ limit }),
    staleTime: 30_000,
    /** Lists are warmed on the assistant shell and updated via realtime; avoid refetch when Settings opens. */
    refetchOnMount: false,
  };
}

export function actionsListQueryOptions(
  limit = ASSISTANT_ACTIONS_LIST_LIMIT,
  offset = 0,
  actionType?: string
) {
  return {
    queryKey: queryKeys.actionsList(limit, offset, actionType),
    queryFn: () => actionsApi.list({ limit, offset, action_type: actionType }),
    staleTime: 30_000,
    refetchOnMount: false,
  };
}

export function useMemoriesQuery(enabled = true, limit = ASSISTANT_MEMORIES_LIST_LIMIT) {
  return useQuery({
    ...memoriesListQueryOptions(limit),
    enabled,
  });
}

export function useActionsQuery(
  enabled = true,
  limit = ASSISTANT_ACTIONS_LIST_LIMIT,
  offset = 0,
  actionType?: string
) {
  return useQuery({
    ...actionsListQueryOptions(limit, offset, actionType),
    enabled,
  });
}

export function useDeleteMemoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: string) => memoriesApi.delete(memoryId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memories });
    },
  });
}

export function useDeleteActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) => actionsApi.delete(actionId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.actions });
    },
  });
}

export function useRecentConversationsQuery(enabled = true, limit = INTERACTION_PANEL_RECENT_LIMIT) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.conversationsRecent(limit),
    queryFn: async (): Promise<Conversation[]> => {
      const rows = await conversationsApi.getRecent(limit, 0);
      for (const c of rows) {
        queryClient.setQueryData<Conversation>(queryKeys.conversationById(c.id), c);
      }
      return rows;
    },
    enabled,
    staleTime: CONVERSATION_STALE_MS,
  });
}

/**
 * Initial interaction load scoped to recent conversation IDs (plus orphans), for the interaction panel.
 */
export function useInteractionsBootstrapQuery(
  conversationIds: string[],
  enabled: boolean,
  limit?: number
) {
  const idsKey = [...conversationIds].sort().join('\u001f');
  return useQuery({
    queryKey: queryKeys.interactionsBootstrap(idsKey),
    queryFn: () => interactionsApi.getBootstrapForConversations(conversationIds, { limit }),
    enabled,
    staleTime: INTERACTIONS_BOOTSTRAP_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useConversationByIdQuery(conversationId: string | null | undefined, enabled = true) {
  const id = conversationId ?? '';
  return useQuery({
    ...conversationQueryOptions(id),
    enabled: Boolean(conversationId) && enabled,
  });
}

export function useAuthMeQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.authMe,
    queryFn: (): Promise<UserMe> => authApi.me(),
    enabled,
  });
}
