import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { conversationsApi } from '@dadei/ui/lib/api/conversations';
import { authApi } from '@dadei/ui/lib/api/auth';
import { serviceApi } from '@dadei/ui/lib/api/service';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import type { Conversation } from '@dadei/ui/types/models.types';
import type { UserMe } from '@dadei/ui/types/auth.types';
import type { IntegrationsStatusResponse } from '@dadei/ui/types/integrations.types';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { useQuery } from '@tanstack/react-query';

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
    staleTime: Infinity,
    refetchOnMount: false,
  });
}
