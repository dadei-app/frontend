import { buildRealtimeWebSocketUrl } from '@dadei/ui/shared/api/realtime';

export type RealtimeMessage = Record<string, unknown> & {
  event?: string;
};

type RealtimeHandler = (msg: RealtimeMessage) => void;

const listeners = new Set<RealtimeHandler>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = true;
let reconnectAttempt = 0;
let connectOpts: { getAccessToken: () => Promise<string | null>; clientId?: string } | null = null;
const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
let lastInboundAt = 0;
let suppressNextCloseReconnect = false;

type RealtimeSessionCapability = {
  clientId: string;
  sessionId: string;
  sessionToken: string;
  expiresInSeconds: number;
};

let activeSessionCapability: RealtimeSessionCapability | null = null;

function emit(msg: RealtimeMessage) {
  listeners.forEach((h) => {
    try {
      h(msg);
    } catch (e) {
      console.error('[Realtime] listener error', e);
    }
  });
}

export function subscribeRealtimeMessages(handler: RealtimeHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearHeartbeatTimer() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function clearHeartbeatWatchdog() {
  if (heartbeatWatchdogTimer) {
    clearTimeout(heartbeatWatchdogTimer);
    heartbeatWatchdogTimer = null;
  }
}

function armHeartbeatWatchdog() {
  clearHeartbeatWatchdog();
  heartbeatWatchdogTimer = setTimeout(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const idleForMs = Date.now() - lastInboundAt;
    if (idleForMs < HEARTBEAT_TIMEOUT_MS) {
      armHeartbeatWatchdog();
      return;
    }
    console.warn('[Realtime] heartbeat timeout, forcing reconnect');
    ws.close(4000, 'heartbeat-timeout');
  }, HEARTBEAT_TIMEOUT_MS);
}

function shouldReconnectForCloseCode(code: number): boolean {
  if (code === 1000) return false;
  if (code === 1008) return false;
  if (code === 4001 || code === 4003) return false;
  return true;
}

function readSessionCapability(msg: RealtimeMessage): RealtimeSessionCapability | null {
  if (msg.event !== 'session_ready') return null;
  const sessionId = typeof msg.session_id === 'string' ? msg.session_id : null;
  const sessionToken = typeof msg.session_token === 'string' ? msg.session_token : null;
  const clientId = typeof msg.client_id === 'string' ? msg.client_id : null;
  const expiresInSeconds =
    typeof msg.expires_in_seconds === 'number' && Number.isFinite(msg.expires_in_seconds)
      ? Math.max(1, Math.floor(msg.expires_in_seconds))
      : HEARTBEAT_TIMEOUT_MS / 1000;
  if (!sessionId || !sessionToken || !clientId) return null;
  return { clientId, sessionId, sessionToken, expiresInSeconds };
}

function scheduleReconnect() {
  if (stopped) return;
  clearReconnectTimer();
  const baseDelay = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
  const delay = Math.floor(baseDelay * (0.5 + Math.random() * 0.5));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    void openSocket();
  }, delay);
}

async function openSocket() {
  if (stopped || !connectOpts) return;

  const token = await connectOpts.getAccessToken();
  if (!token) {
    scheduleReconnect();
    return;
  }

  const base = buildRealtimeWebSocketUrl();
  const qs = new URLSearchParams();
  qs.set('token', token);
  if (connectOpts.clientId?.trim()) {
    qs.set('client_id', connectOpts.clientId.trim());
  }
  const url = `${base}?${qs.toString()}`;

  try {
    ws = new WebSocket(url);
  } catch (e) {
    console.error('[Realtime] WebSocket construct failed', e);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempt = 0;
    console.log('[Realtime] connected');
    emit({ event: 'realtime_status', connected: true });
    lastInboundAt = Date.now();
    clearHeartbeatTimer();
    clearHeartbeatWatchdog();
    armHeartbeatWatchdog();
    heartbeatTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'ping' }));
    }, HEARTBEAT_INTERVAL_MS);
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data)) as RealtimeMessage;
      const capability = readSessionCapability(msg);
      if (capability) {
        activeSessionCapability = capability;
        if (connectOpts) {
          connectOpts = { ...connectOpts, clientId: capability.clientId };
        }
      }
      lastInboundAt = Date.now();
      armHeartbeatWatchdog();
      emit(msg);
    } catch (e) {
      console.error('[Realtime] bad message', e);
    }
  };

  ws.onerror = () => {
    /* onclose will handle */
  };

  ws.onclose = (event) => {
    clearHeartbeatTimer();
    clearHeartbeatWatchdog();
    ws = null;
    if (suppressNextCloseReconnect) {
      suppressNextCloseReconnect = false;
      return;
    }
    emit({ event: 'realtime_status', connected: false, code: event.code });
    if (!stopped && shouldReconnectForCloseCode(event.code)) {
      console.warn('[Realtime] disconnected, reconnecting…');
      scheduleReconnect();
    }
  };
}

export function startRealtimeClient(opts: {
  getAccessToken: () => Promise<string | null>;
  clientId?: string;
}): void {
  stopped = false;
  connectOpts = opts;
  reconnectAttempt = 0;
  clearReconnectTimer();
  if (ws) {
    suppressNextCloseReconnect = true;
    ws.close();
    ws = null;
  }
  void openSocket();
}

export function stopRealtimeClient(): void {
  stopped = true;
  connectOpts = null;
  activeSessionCapability = null;
  clearReconnectTimer();
  clearHeartbeatTimer();
  clearHeartbeatWatchdog();
  reconnectAttempt = 0;
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}

export function getRealtimeSessionToken(): string | null {
  return activeSessionCapability?.sessionToken ?? null;
}

export function getRealtimeSessionId(): string | null {
  return activeSessionCapability?.sessionId ?? null;
}

export function getRealtimeClientId(): string | null {
  return activeSessionCapability?.clientId ?? connectOpts?.clientId ?? null;
}
