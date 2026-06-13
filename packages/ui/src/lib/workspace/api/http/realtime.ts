const isBeta = process.env.BETA === 'true';
const API_PREFIX = isBeta ? '/api/v2' : '/api/v1';
const apiUrl = process.env.API_URL || 'http://localhost:8000';

/**
 * WebSocket URL for `{API_PREFIX}/realtime/ws` (same `BETA` / prefix as REST), same host as `API_URL`.
 */
export function buildRealtimeWebSocketUrl(): string {
  const wsProto = apiUrl.startsWith('https') ? 'wss' : 'ws';
  const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${wsProto}://${host}${API_PREFIX}/realtime/ws`;
}
