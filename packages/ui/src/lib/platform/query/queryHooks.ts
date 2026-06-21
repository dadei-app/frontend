import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { conversationsApi } from '@dadei/ui/lib/workspace/api/conversations';
import { authApi } from '@dadei/ui/lib/workspace/api/auth';
import { serviceApi } from '@dadei/ui/lib/workspace/api/service';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import type { Conversation } from '@dadei/ui/types/models.types';
import type { UserMe } from '@dadei/ui/types/auth.types';
import type { IntegrationsStatusResponse } from '@dadei/ui/types/integrations.types';
import { subscriptionApi } from '@dadei/ui/lib/workspace/api/subscription';
import type { SubscriptionView } from '@dadei/ui/types/subscription.types';
import {
  ASSISTANT_MEMORIES_LIST_LIMIT,
  AUTH_ME_STALE_MS,
  INTERACTION_PANEL_RECENT_LIMIT,
} from '@dadei/ui/lib/platform/query/constants';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';
import { useQuery } from '@tanstack/react-query';

export { INTERACTION_PANEL_RECENT_LIMIT } from '@dadei/ui/lib/platform/query/constants';

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
} from '@dadei/ui/lib/platform/query/cacheUtils';

export { ASSISTANT_MEMORIES_LIST_LIMIT } from '@dadei/ui/lib/platform/query/constants';

export function useAuthMeQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.authMe,
    queryFn: (): Promise<UserMe> => authApi.me(),
    enabled,
    staleTime: AUTH_ME_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/** True while the network has not completed onboarding (`tutorial_completed` is false). */
export function useNeedsTutorial(enabled = true): boolean {
  const { isAuthenticated, isLoading } = useAuth();
  const { isBootstrapReady } = useSystem();
  const meQuery = useAuthMeQuery(
    enabled && isAuthenticated && isBootstrapReady && !isLoading,
  );
  return Boolean(meQuery.data && !meQuery.data.tutorial_completed);
}

export function useTutorialCompleted(enabled = true): boolean {
  const { isAuthenticated, isLoading } = useAuth();
  const { isBootstrapReady } = useSystem();
  const meQuery = useAuthMeQuery(
    enabled && isAuthenticated && isBootstrapReady && !isLoading,
  );
  return Boolean(meQuery.data?.tutorial_completed);
}

async function applyPasswordSessionTokens(
  queryClient: ReturnType<typeof useQueryClient>,
  saveTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>,
  refreshUser: () => Promise<void>,
  data: { access_token: string; refresh_token: string },
) {
  await saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  });
  await queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
  await refreshUser();
}

export function useSetPasswordMutation() {
  const queryClient = useQueryClient();
  const { saveTokens, refreshUser } = useAuth();
  return useMutation({
    mutationFn: (newPassword: string) => authApi.setPassword(newPassword),
    onSuccess: async data => {
      await applyPasswordSessionTokens(queryClient, saveTokens, refreshUser, data);
    },
  });
}

export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  const { saveTokens, refreshUser } = useAuth();
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      authApi.changePassword(current, next),
    onSuccess: async data => {
      await applyPasswordSessionTokens(queryClient, saveTokens, refreshUser, data);
    },
  });
}

export function useIntegrationsStatusQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.integrationsStatus,
    queryFn: (): Promise<IntegrationsStatusResponse> => serviceApi.integrationsStatus(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: true,
  });
}

const SUBSCRIPTION_STALE_MS = 30_000;

export function useSubscription(enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: (): Promise<SubscriptionView> => subscriptionApi.getSubscription(),
    enabled,
    staleTime: SUBSCRIPTION_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

export function invalidateSubscription(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
}
