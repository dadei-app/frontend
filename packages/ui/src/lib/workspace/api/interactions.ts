import { api } from '@dadei/ui/lib/workspace/api/http/client';
import { ENDPOINTS, API_CONFIG } from '@dadei/ui/lib/workspace/api/http/constants';
import { buildEndpoint } from './utils';
import { Interaction } from '@dadei/ui/types/models.types';
import { getRealtimeClientId, getRealtimeSessionToken } from '@dadei/ui/lib/assistant/realtime/realtimeClient';

interface GetInteractionsParams {
  limit?: number;
  offset?: number;
}

function interactionsBootstrapParamsSerializer(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  const limit = params.limit != null ? String(params.limit) : '500';
  const offset = params.offset != null ? String(params.offset) : '0';
  sp.set('limit', limit);
  sp.set('offset', offset);
  if (params.orphans_only === true || params.orphans_only === 'true') {
    sp.set('orphans_only', 'true');
  }
  const ids = params.conversation_ids as string[] | undefined;
  if (ids?.length) {
    for (const id of ids) {
      sp.append('conversation_ids', id);
    }
  }
  return sp.toString();
}

export interface RegisterInteractionTiming {
  chunkStartMs?: number;
  chunkEndMs?: number;
}

export const interactionsApi = {
  /**
   * Get all interactions for the network
   * GET /api/v1/interactions
   */
  async getAll(params?: GetInteractionsParams): Promise<Interaction[]> {
    const { data } = await api.get<Interaction[]>(ENDPOINTS.INTERACTIONS, {
      params: {
        limit: params?.limit || 50,
        offset: params?.offset || 0,
      },
    });
    return data;
  },

  /**
   * Interactions for bootstrap: given conversation rows plus orphan interactions.
   * GET /api/v1/interactions?conversation_ids=...&conversation_ids=... (repeated) or orphans_only=true
   */
  async getBootstrapForConversations(
    conversationIds: string[],
    params?: { limit?: number }
  ): Promise<Interaction[]> {
    const limit = params?.limit ?? 500;
    const requestParams: Record<string, unknown> =
      conversationIds.length > 0
        ? { limit, offset: 0, conversation_ids: conversationIds }
        : { limit, offset: 0, orphans_only: true };

    const { data } = await api.get<Interaction[]>(ENDPOINTS.INTERACTIONS, {
      params: requestParams,
      paramsSerializer: interactionsBootstrapParamsSerializer,
    });
    return data;
  },

  /**
   * Get interaction by ID
   * GET /api/v1/interactions/{interaction_id}
   */
  async getById(interactionId: string): Promise<Interaction> {
    const endpoint = buildEndpoint(ENDPOINTS.INTERACTION_BY_ID, { interactionId });
    const { data } = await api.get<Interaction>(endpoint);
    return data;
  },

  /**
   * Delete interaction
   * DELETE /api/v1/interactions/{interaction_id}
   */
  async delete(interactionId: string): Promise<void> {
    const endpoint = buildEndpoint(ENDPOINTS.INTERACTION_BY_ID, { interactionId });
    await api.delete(endpoint);
  },

  /**
   * Register interaction from audio
   * POST /api/v1/interactions/register
   *
   * Returns 204 No Content immediately
   * Actual interaction data is pushed over the realtime WebSocket
   */
  async register(
    audioData: ArrayBuffer,
    clientId?: string,
    timing?: RegisterInteractionTiming,
  ): Promise<void> {
    const effectiveClientId = clientId?.trim() || getRealtimeClientId();
    if (!effectiveClientId) {
      throw new Error('No active realtime client id available');
    }
    const formData = new FormData();
    const blob = new Blob([audioData], { type: 'audio/wav' });
    formData.append('audio', blob, 'audio.wav');
    formData.append('client_id', effectiveClientId);
    const sessionToken = getRealtimeSessionToken();
    if (sessionToken) {
      formData.append('session_token', sessionToken);
    }
    if (timing?.chunkStartMs != null) {
      formData.append('chunk_start_ms', String(timing.chunkStartMs));
    }
    if (timing?.chunkEndMs != null) {
      formData.append('chunk_end_ms', String(timing.chunkEndMs));
    }

    try {
      await api.post(
        ENDPOINTS.INTERACTIONS_REGISTER,
        formData,
        {
          timeout: API_CONFIG.TIMEOUTS.INTERACTION,
          validateStatus: (status) => status === 204,
        }
      );
    } catch (error: any) {
      console.error('Failed to register interaction:', error);
    }
  },
};