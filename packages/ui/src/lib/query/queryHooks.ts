import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { actionsApi } from '@dadei/ui/lib/api/actions';
import { memoriesApi } from '@dadei/ui/lib/api/memories';
import { personsApi } from '@dadei/ui/lib/api/persons';
import { interactionsApi } from '@dadei/ui/lib/api/interactions';
import { conversationsApi } from '@dadei/ui/lib/api/conversations';
import { authApi } from '@dadei/ui/lib/api/auth';
import { networkApi, type NetworkUpdate } from '@dadei/ui/lib/api/network';
import { serviceApi } from '@dadei/ui/lib/api/service';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import type { Conversation, NetworkAction, Person } from '@dadei/ui/types/models.types';
import type { UserMe } from '@dadei/ui/types/auth.types';
import type { IntegrationsStatusResponse } from '@dadei/ui/types/integrations.types';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';

const AUTH_ME_STALE_MS = 5 * 60_000;

/** Recent conversation page size for the interaction panel bootstrap. */
export const INTERACTION_PANEL_RECENT_LIMIT = 10;

/** Shared options so every code path (useQueries, prefetch, realtime) hits the same cache shape. */
export function conversationQueryOptions(conversationId: string) {
  return {
    queryKey: queryKeys.conversationById(conversationId),
    queryFn: (): Promise<Conversation> => conversationsApi.getById(conversationId),
    staleTime: Infinity,
    retry: (failureCount: number, error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 404) return false;
      return failureCount < 3;
    },
  };
}

export {
  clearAssistantSessionCaches,
  removeAllConversationQueries,
} from '@dadei/ui/lib/query/cacheUtils';

/** Default list sizes for assistant shell + settings (matches interaction panel style scoped keys). */
export const ASSISTANT_MEMORIES_LIST_LIMIT = 100;

export function usePersonsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.persons,
    queryFn: () => personsApi.getAll(),
    enabled,
    staleTime: Infinity,
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
    staleTime: Infinity,
  });
}

export function memoriesListQueryOptions(limit = ASSISTANT_MEMORIES_LIST_LIMIT) {
  return {
    queryKey: queryKeys.memoriesList(limit),
    queryFn: () => memoriesApi.list({ limit }),
    staleTime: Infinity,
    refetchOnMount: false,
  };
}

export function useMemoriesQuery(enabled = true, limit = ASSISTANT_MEMORIES_LIST_LIMIT) {
  return useQuery({
    ...memoriesListQueryOptions(limit),
    enabled,
  });
}

/** Push-only state for notification banners (`action_queue` WebSocket events). */
export function useNotificationActionsQuery() {
  const queryClient = useQueryClient();
  const [actions, setActions] = useState<NetworkAction[]>(
    () => queryClient.getQueryData<NetworkAction[]>(queryKeys.actions) ?? [],
  );

  useEffect(() => {
    const key = queryKeys.actions;
    const sync = () => {
      setActions(queryClient.getQueryData<NetworkAction[]>(key) ?? []);
    };
    sync();
    return queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] !== key[0]) return;
      if (event.type === 'updated' || event.type === 'added') {
        sync();
      }
    });
  }, [queryClient]);

  return { data: actions };
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
    staleTime: Infinity,
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
    staleTime: Infinity,
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
    staleTime: AUTH_ME_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateNetworkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NetworkUpdate) => networkApi.update(payload),
    onSuccess: data => {
      queryClient.setQueryData<UserMe | undefined>(queryKeys.authMe, prev =>
        prev ? { ...prev, name: data.name, timezone: data.timezone } : prev,
      );
    },
  });
}

export function useSetPasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newPassword: string) => authApi.setPassword(newPassword),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
    },
  });
}

export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  const { saveTokens } = useAuth();
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      authApi.changePassword(current, next),
    onSuccess: async data => {
      await saveTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
    },
  });
}

export function useIntegrationsStatusQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.integrationsStatus,
    queryFn: (): Promise<IntegrationsStatusResponse> => serviceApi.integrationsStatus(),
    enabled,
  });
}
