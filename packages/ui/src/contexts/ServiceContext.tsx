
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { serviceApi } from '@dadei/ui/lib/api/service';
import {
  sendRealtimeMessage,
  startRealtimeClient,
  stopRealtimeClient,
  subscribeRealtimeMessages,
} from '@dadei/ui/lib/realtime/realtimeClient';
import { getRealtimeSessionId } from '@dadei/ui/lib/realtime/realtimeClient';
import { clearAssistantSessionCaches } from '@dadei/ui/lib/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import type { NetworkAction } from '@dadei/ui/types/models.types';

interface ServiceContextType {
  isServiceEnabled: boolean;
  isConnected: boolean;
  /** True when device registration with the service failed after sign-in. */
  registrationConflict: boolean;
  /** Server-assigned or persisted device client id (opaque string). */
  clientName: string;
  toggleService: () => Promise<void>;
  isTogglingService: boolean;
  isAssistantMode: boolean;
  isAssistantOwner: boolean;
  assistantOwnerSessionId: string | null;
  assistantModeExpiresAt: string | null;
  assistantModeRemainingMs: number;
}

export const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

const ENABLE_TIMEOUT_MS = 5000;
const CLIENT_CONTEXT_LOCATION_TIMEOUT_MS = 3500;

function isNetworkAction(data: unknown): data is NetworkAction {
  if (!data || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.action_type === 'string' && typeof o.status === 'string';
}

type ClientContextKey = 'timezone' | 'location';

function normalizeClientContextKeys(input: unknown): ClientContextKey[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<ClientContextKey>();
  for (const key of input) {
    const k = String(key).trim().toLowerCase();
    if (k === 'timezone' || k === 'location') out.add(k);
  }
  return [...out];
}

function getClientTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function getClientLocation(): Promise<Record<string, unknown> | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          timestamp_ms: pos.timestamp,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: CLIENT_CONTEXT_LOCATION_TIMEOUT_MS,
      },
    );
  });
}

async function buildClientContextResponse(keys: ClientContextKey[]): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  if (keys.includes('timezone')) {
    data.timezone = getClientTimezone();
  }
  if (keys.includes('location')) {
    data.location = await getClientLocation();
  }
  return data;
}

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const [isServiceEnabled, setIsServiceEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [clientName, setClientName] = useState('');
  const [isTogglingService, setIsTogglingService] = useState(false);
  const [registrationConflict, setRegistrationConflict] = useState(false);
  const [isAssistantMode, setIsAssistantMode] = useState(false);
  const [assistantOwnerSessionId, setAssistantOwnerSessionId] = useState<string | null>(null);
  const [assistantModeExpiresAt, setAssistantModeExpiresAt] = useState<string | null>(null);

  const enableTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isAuthenticated) {
      stopRealtimeClient();
      setIsConnected(false);
      setRegistrationConflict(false);
      setIsAssistantMode(false);
      setAssistantOwnerSessionId(null);
      setAssistantModeExpiresAt(null);
      clearAssistantSessionCaches(queryClient);
    }
  }, [isAuthenticated, queryClient]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      setIsConnected(false);
      return;
    }

    let cancelled = false;

    const connectRealtime = async () => {
      try {
        if (cancelled) {
          return;
        }
        setRegistrationConflict(false);
        startRealtimeClient({
          getAccessToken: () => getAccessTokenRef.current(),
        });
      } catch (error: unknown) {
        console.error('Failed to start realtime client:', error);
        setRegistrationConflict(true);
        setIsConnected(false);
        stopRealtimeClient();
      }
    };

    void connectRealtime();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    const handleServiceStatusChanged = (status: { enabled: boolean }) => {
      console.log('[Service] Status event:', status.enabled ? 'ENABLED' : 'DISABLED');

      if (enableTimeoutRef.current) {
        clearTimeout(enableTimeoutRef.current);
        enableTimeoutRef.current = null;
      }

      setIsServiceEnabled(status.enabled);
      setIsTogglingService(false);
    };
    const handleAssistantModeChanged = (payload: {
      active: boolean;
      ownerSessionId: string | null;
      expiresAt: string | null;
    }) => {
      setIsAssistantMode(payload.active);
      setAssistantOwnerSessionId(payload.ownerSessionId);
      setAssistantModeExpiresAt(payload.expiresAt);
    };

    const offWs = subscribeRealtimeMessages(msg => {
      if (msg.event === 'client_context_request') {
        const requestId = typeof msg.request_id === 'string' ? msg.request_id.trim() : '';
        const keys = normalizeClientContextKeys(msg.keys);
        if (!requestId || keys.length === 0) return;
        void (async () => {
          const data = await buildClientContextResponse(keys);
          sendRealtimeMessage({
            type: 'client_context_response',
            request_id: requestId,
            data,
          });
        })();
        return;
      }
      if (msg.event === 'realtime_status') {
        if (typeof msg.connected === 'boolean') {
          setIsConnected(msg.connected);
        }
        return;
      }
      if (msg.event === 'session_ready') {
        const serverClientId = typeof msg.client_id === 'string' ? msg.client_id : null;
        if (serverClientId) {
          setClientName(serverClientId);
        }
        setIsConnected(true);
        setRegistrationConflict(false);
        return;
      }
      if (msg.event === 'service_status') {
        if (typeof msg.enabled !== 'boolean') return;
        handleServiceStatusChanged({ enabled: msg.enabled });
        return;
      }
      if (msg.event === 'assistant_mode') {
        const active = typeof msg.active === 'boolean' ? msg.active : false;
        const ownerSessionId =
          typeof msg.owner_session_id === 'string' ? msg.owner_session_id : null;
        const expiresAt = typeof msg.expires_at === 'string' ? msg.expires_at : null;
        handleAssistantModeChanged({ active, ownerSessionId, expiresAt });
      }
    });

    let offElectron: (() => void) | undefined;
    if (window.electronAPI?.onServiceStatusChanged) {
      offElectron = window.electronAPI.onServiceStatusChanged(handleServiceStatusChanged);
    }

    return () => {
      offWs();
      if (offElectron) offElectron();
    };
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const actionKey = queryKeys.actions;

    const applyActionQueue = (queue: NetworkAction[]) => {
      queryClient.setQueryData<NetworkAction[]>(actionKey, queue);
    };

    const offWs = subscribeRealtimeMessages(msg => {
      if (msg.event === 'action_queue') {
        if (!isNetworkActionQueue(msg.data)) return;
        applyActionQueue(msg.data);
      }
    });

    let offElectron: (() => void) | undefined;
    if (window.electronAPI?.onWebhookAction) {
      offElectron = window.electronAPI.onWebhookAction(payload => {
        if (payload?.event === 'action_queue' && isNetworkActionQueue(payload?.data)) {
          applyActionQueue(payload.data);
        }
      });
    }

    return () => {
      offWs();
      if (offElectron) offElectron();
    };
  }, [isConnected, queryClient]);

  const toggleService = useCallback(async () => {
    if (registrationConflict) {
      console.warn('[Service] Registration conflict: cannot toggle service');
      return;
    }

    setIsTogglingService(true);

    try {
      if (isServiceEnabled) {
        await serviceApi.disable();
      } else {
        await serviceApi.enable();

        enableTimeoutRef.current = setTimeout(() => {
          console.error('[Service] Enable timeout - no status event received');
          setIsTogglingService(false);
        }, ENABLE_TIMEOUT_MS);
      }
    } catch (error) {
      console.error('Failed to toggle service:', error);
      setIsTogglingService(false);
    }
  }, [isServiceEnabled, registrationConflict]);

  const realtimeSessionId = getRealtimeSessionId();
  const isAssistantOwner =
    isAssistantMode && !!realtimeSessionId && assistantOwnerSessionId === realtimeSessionId;
  const assistantModeRemainingMs = (() => {
    if (!assistantModeExpiresAt) return 0;
    const expiresAtMs = Date.parse(assistantModeExpiresAt);
    if (!Number.isFinite(expiresAtMs)) return 0;
    return Math.max(0, expiresAtMs - Date.now());
  })();

  return (
    <ServiceContext.Provider
      value={{
        isServiceEnabled,
        isConnected,
        registrationConflict,
        clientName,
        toggleService,
        isTogglingService,
        isAssistantMode,
        isAssistantOwner,
        assistantOwnerSessionId,
        assistantModeExpiresAt,
        assistantModeRemainingMs,
      }}
    >
      {children}
    </ServiceContext.Provider>
  );
}

export function useService() {
  const context = useContext(ServiceContext);
  if (context === undefined) {
    throw new Error('useService must be used within a ServiceProvider');
  }
  return context;
}
