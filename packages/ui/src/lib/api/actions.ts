import { api } from '@dadei/ui/shared/api/client';
import { ENDPOINTS } from '@dadei/ui/shared/api/constants';
import type { NetworkAction } from '@dadei/ui/types/models.types';

import { buildEndpoint } from './utils';

export interface ListActionsParams {
  limit?: number;
  offset?: number;
  action_type?: string;
}

export const actionsApi = {
  async list(params?: ListActionsParams): Promise<NetworkAction[]> {
    const { data } = await api.get<NetworkAction[]>(ENDPOINTS.ACTIONS, {
      params: {
        limit: params?.limit ?? 100,
        offset: params?.offset ?? 0,
        ...(params?.action_type ? { action_type: params.action_type } : {}),
      },
    });
    return data;
  },

  async updateStatus(id: string, status: 'confirmed' | 'dismissed'): Promise<NetworkAction> {
    const endpoint = buildEndpoint(ENDPOINTS.ACTION_BY_ID, { actionId: id });
    const { data } = await api.patch<NetworkAction>(endpoint, { status });
    return data;
  },

  async delete(id: string): Promise<void> {
    const endpoint = buildEndpoint(ENDPOINTS.ACTION_BY_ID, { actionId: id });
    await api.delete(endpoint);
  },

  async accept(id: string): Promise<NetworkAction> {
    const endpoint = `${buildEndpoint(ENDPOINTS.ACTION_BY_ID, { actionId: id })}/accept`;
    const { data } = await api.post<NetworkAction>(endpoint);
    return data;
  },

  async reject(id: string): Promise<NetworkAction> {
    const endpoint = `${buildEndpoint(ENDPOINTS.ACTION_BY_ID, { actionId: id })}/reject`;
    const { data } = await api.post<NetworkAction>(endpoint);
    return data;
  },
};
