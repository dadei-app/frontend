import { api } from '@dadei/ui/lib/workspace/api/http/client';

export interface NetworkResponse {
  id: string;
  name: string;
  email: string;
  timezone: string;
  service_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NetworkUpdate {
  name?: string;
  timezone?: string;
}

export const networkApi = {
  async update(payload: NetworkUpdate): Promise<NetworkResponse> {
    const { data } = await api.patch<NetworkResponse>('/network', payload);
    return data;
  },
};
