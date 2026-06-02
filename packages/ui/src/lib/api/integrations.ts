import { api } from '@dadei/ui/shared/api/client';
import { ENDPOINTS } from '@dadei/ui/shared/api/constants';
import type { IntegrationsStatusResponse } from '@dadei/ui/types/integrations.types';

export const integrationsApi = {
  /**
   * GET /api/v2/integrations/status when `BETA=true` (same base as `api` client)
   */
  status: async (): Promise<IntegrationsStatusResponse> => {
    const { data } = await api.get<IntegrationsStatusResponse>(ENDPOINTS.INTEGRATIONS_STATUS);
    return data;
  },
};
