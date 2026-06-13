import { api } from '@dadei/ui/lib/workspace/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/workspace/api/http/constants';
import type { EpisodicMemory } from '@dadei/ui/types/models.types';
import { buildEndpoint } from './utils';

export interface ListMemoriesParams {
  limit?: number;
}

export const memoriesApi = {
  async list(params?: ListMemoriesParams): Promise<EpisodicMemory[]> {
    const { data } = await api.get<EpisodicMemory[]>(ENDPOINTS.MEMORIES, {
      params: { limit: params?.limit ?? 100 },
    });
    return data;
  },

  async delete(id: string): Promise<void> {
    const endpoint = buildEndpoint(ENDPOINTS.MEMORY_BY_ID, { memoryId: id });
    await api.delete(endpoint);
  },
};
