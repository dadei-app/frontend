import { api } from '@dadei/ui/lib/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/api/http/constants';
import { buildEndpoint } from '@dadei/ui/lib/api/utils';
import { Conversation } from '@dadei/ui/types/models.types';

export const conversationsApi = {
  /**
   * List recent conversations for the network (newest first).
   * GET /api/v1/conversations?limit=&offset=
   */
  async getRecent(limit = 10, offset = 0): Promise<Conversation[]> {
    const { data } = await api.get<Conversation[]>(ENDPOINTS.CONVERSATIONS, {
      params: { limit, offset },
    });
    return data;
  },

  /**
   * @deprecated Prefer {@link getRecent}; kept for callers that want a larger page.
   */
  async getAll(): Promise<Conversation[]> {
    return conversationsApi.getRecent(100, 0);
  },

  /**
   * Get conversation by ID
   * GET /api/v1/conversations/{conversation_id}
   */
  async getById(conversationId: string): Promise<Conversation> {
    const endpoint = buildEndpoint(ENDPOINTS.CONVERSATION_BY_ID, { conversationId });
    const { data } = await api.get<Conversation>(endpoint);
    return data;
  },

  /**
   * Delete a conversation by ID
   * DELETE /api/v1/conversations/{conversation_id}
   */
  async delete(conversationId: string): Promise<void> {
    const endpoint = buildEndpoint(ENDPOINTS.CONVERSATION_BY_ID, { conversationId });
    await api.delete(endpoint);
  },
};