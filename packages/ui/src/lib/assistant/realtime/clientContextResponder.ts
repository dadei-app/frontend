import {
  sendRealtimeMessage,
  subscribeRealtimeMessages,
} from '@dadei/ui/lib/assistant/realtime/realtimeClient';

const LOCATION_TIMEOUT_MS = 3500;

type ClientContextKey = 'timezone' | 'location';
type DeviceInfoKey = 'now_playing' | 'battery' | 'screenshot';

function normalizeClientContextKeys(input: unknown): ClientContextKey[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<ClientContextKey>();
  for (const key of input) {
    const k = String(key).trim().toLowerCase();
    if (k === 'timezone' || k === 'location') out.add(k);
  }
  return [...out];
}

function normalizeDeviceInfoKeys(input: unknown): DeviceInfoKey[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<DeviceInfoKey>();
  for (const key of input) {
    const k = String(key).trim().toLowerCase();
    if (k === 'now_playing' || k === 'battery' || k === 'screenshot') out.add(k);
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
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => {
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
        timeout: LOCATION_TIMEOUT_MS,
      },
    );
  });
}

async function buildClientContextResponse(
  keys: ClientContextKey[],
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  if (keys.includes('timezone')) data.timezone = getClientTimezone();
  if (keys.includes('location')) data.location = await getClientLocation();
  return data;
}

async function buildDeviceInfoResponse(keys: DeviceInfoKey[]): Promise<Record<string, unknown>> {
  if (!window.electronAPI?.getDeviceInfo) return {};
  return window.electronAPI.getDeviceInfo(keys);
}

let started = false;
let unsubscribe: (() => void) | null = null;

export function startClientContextResponder(): () => void {
  if (started) return unsubscribe ?? (() => {});
  started = true;

  unsubscribe = subscribeRealtimeMessages(msg => {
    if (msg.event === 'client_context_request') {
      const requestId = typeof msg.request_id === 'string' ? msg.request_id.trim() : '';
      const keys = normalizeClientContextKeys(msg.keys);
      if (!requestId || keys.length === 0) return;
      void (async () => {
        const data = await buildClientContextResponse(keys);
        sendRealtimeMessage({ type: 'client_context_response', request_id: requestId, data });
      })();
      return;
    }
    if (msg.event === 'device_info_request') {
      const requestId = typeof msg.request_id === 'string' ? msg.request_id.trim() : '';
      const keys = normalizeDeviceInfoKeys(msg.keys);
      if (!requestId || keys.length === 0) return;
      void (async () => {
        const data = await buildDeviceInfoResponse(keys);
        sendRealtimeMessage({ type: 'device_info_response', request_id: requestId, data });
      })();
    }
  });

  return () => {
    unsubscribe?.();
    unsubscribe = null;
    started = false;
  };
}
