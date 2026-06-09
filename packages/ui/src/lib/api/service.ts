import { api } from '@dadei/ui/lib/api/http/client';
import { API_CONFIG, ENDPOINTS } from '@dadei/ui/lib/api/http/constants';
import type { IntegrationsStatusResponse } from '@dadei/ui/types/integrations.types';
import { buildEndpoint, getClientIpAddresses, retryWithBackoff } from './utils';

interface ClientRegistration {
  client_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ClientResponse {
  client_id: string;
  connected_at: string;
  metadata?: Record<string, unknown>;
}

export interface CommandModeState {
  active: boolean;
  owner_session_id: string | null;
  expires_at: string | null;
}

export const serviceApi = {
  /**
   * Register client with network. Omit clientId to let the server assign client1, client2, …
   * POST /api/v1/service/clients
   */
  async registerClient(clientId?: string): Promise<ClientResponse> {
    const ipAddresses = getClientIpAddresses();

    const registration: ClientRegistration = {
      metadata: {
        local_ip: ipAddresses.local,
        external_ip: ipAddresses.external,
      },
    };
    if (clientId) {
      registration.client_id = clientId;
    }

    const { data } = await api.post<ClientResponse>(ENDPOINTS.SERVICE_CLIENTS, registration);
    return data;
  },

  /**
   * Deregister client from network
   * DELETE /api/v1/service/clients/{client_id}
   */
  async deregisterClient(clientId: string): Promise<void> {
    const endpoint = buildEndpoint(ENDPOINTS.SERVICE_CLIENT_BY_ID, { clientId });
    await api.delete(endpoint);
  },

  /**
   * List all registered clients
   * GET /api/v1/service/clients
   */
  async listClients(): Promise<string[]> {
    const { data } = await api.get(ENDPOINTS.SERVICE_CLIENTS);
    return data;
  },

  /**
   * Enable service for network
   * PATCH /api/v1/service/network/enable
   */
  async enable(): Promise<void> {
    await api.patch(ENDPOINTS.SERVICE_NETWORK_ENABLE);
  },

  /**
   * Disable service for network with retry
   * PATCH /api/v1/service/network/disable
   */
  async disable(): Promise<void> {
    await retryWithBackoff(
      () => api.patch(ENDPOINTS.SERVICE_NETWORK_DISABLE)
    );
  },

  /**
   * Attempt to claim command mode ownership for a short conversational window.
   * PATCH /api/v1/service/network/command-mode/claim
   */
  async claimCommandMode(sessionToken: string, holdSeconds = 5): Promise<CommandModeState> {
    const { data } = await api.patch<CommandModeState>(
      ENDPOINTS.SERVICE_COMMAND_MODE_CLAIM,
      {
        session_token: sessionToken,
        hold_seconds: holdSeconds,
      },
      { timeout: API_CONFIG.TIMEOUTS.COMMAND_MODE },
    );
    return data;
  },

  /**
   * Release command mode ownership.
   * PATCH /api/v1/service/network/command-mode/release
   */
  async releaseCommandMode(sessionToken: string): Promise<void> {
    await api.patch(
      ENDPOINTS.SERVICE_COMMAND_MODE_RELEASE,
      {
        session_token: sessionToken,
      },
      { timeout: API_CONFIG.TIMEOUTS.COMMAND_MODE },
    );
  },

  /**
   * Google integration scope status for the settings UI.
   * GET /api/v1/service/integrations/status (v2 when BETA=true)
   */
  async integrationsStatus(): Promise<IntegrationsStatusResponse> {
    const { data } = await api.get<IntegrationsStatusResponse>(
      ENDPOINTS.SERVICE_INTEGRATIONS_STATUS,
    );
    return data;
  },
};
