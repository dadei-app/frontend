import { api } from '@dadei/ui/lib/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/api/http/constants';
import type { NetworkAction } from '@dadei/ui/types/models.types';

import { buildEndpoint } from './utils';

export const actionsApi = {
  async listActive(): Promise<NetworkAction[]> {
    const { data } = await api.get<NetworkAction[]>(ENDPOINTS.ACTIONS);
    return data;
  },

  async reject(actionId: string): Promise<NetworkAction> {
    const endpoint = `${buildEndpoint(ENDPOINTS.ACTION_BY_ID, { actionId })}/reject`;
    const { data } = await api.post<NetworkAction>(endpoint);
    return data;
  },
};
