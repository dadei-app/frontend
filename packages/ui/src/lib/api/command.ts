import { API_BASE_URL } from '@dadei/ui/shared/api/client';
import { ENDPOINTS } from '@dadei/ui/shared/api/constants';
import { getRealtimeSessionToken } from '@dadei/ui/lib/realtimeClient';

export type CommandSSEEvent =
  | { type: 'transcript'; text: string }
  | { type: 'token'; text: string }
  | { type: 'tool_call'; tool: string; status: string }
  | { type: 'tool_result'; tool: string; ok: boolean; summary?: string }
  | { type: 'error'; message: string }
  | { type: 'session_end' }
  | { type: 'done' };

/** Fetch / ReadableStream abort — browsers vary (AbortError vs "body stream buffer was aborted"). */
export function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (e instanceof Error && /abort/i.test(e.message)) return true;
  return false;
}

function parseDataLine(line: string): CommandSSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const jsonPart = trimmed.slice(5).trim();
  if (!jsonPart) return null;
  try {
    return JSON.parse(jsonPart) as CommandSSEEvent;
  } catch {
    return null;
  }
}

export async function* streamCommand(
  wavBuffer: ArrayBuffer,
  accessToken: string,
  options?: { signal?: AbortSignal },
): AsyncGenerator<CommandSSEEvent> {
  const url = `${API_BASE_URL}${ENDPOINTS.COMMAND}`;
  const form = new FormData();
  form.append('audio', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
  const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (clientTimeZone && clientTimeZone.trim()) {
    form.append('client_timezone', clientTimeZone.trim());
  }
  const sessionToken = getRealtimeSessionToken();
  if (!sessionToken) {
    yield { type: 'error', message: 'Not connected to the assistant service yet' };
    yield { type: 'done' };
    return;
  }
  form.append('session_token', sessionToken);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
      signal: options?.signal,
    });
  } catch (e) {
    if (isAbortError(e) || options?.signal?.aborted) {
      yield { type: 'done' };
      return;
    }
    const message = e instanceof Error ? e.message : 'Network error';
    yield { type: 'error', message };
    yield { type: 'done' };
    return;
  }

  if (!response.ok || !response.body) {
    let detail = `HTTP ${response.status}`;
    try {
      const t = await response.text();
      if (t) {
        try {
          const parsed = JSON.parse(t) as { detail?: unknown };
          if (typeof parsed.detail === 'string') {
            detail = parsed.detail.slice(0, 240);
          } else if (parsed.detail && typeof parsed.detail === 'object') {
            const detailObj = parsed.detail as { message?: unknown; code?: unknown };
            if (typeof detailObj.message === 'string' && typeof detailObj.code === 'string') {
              detail = `${detailObj.code}: ${detailObj.message}`.slice(0, 240);
            } else {
              detail = t.slice(0, 240);
            }
          } else {
            detail = t.slice(0, 240);
          }
        } catch {
          detail = t.slice(0, 240);
        }
      }
    } catch {
      /* ignore */
    }
    yield { type: 'error', message: detail };
    yield { type: 'done' };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const ev = parseDataLine(line);
        if (ev) {
          if (ev.type === 'done') sawDone = true;
          yield ev;
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        const ev = parseDataLine(line);
        if (ev) {
          if (ev.type === 'done') sawDone = true;
          yield ev;
        }
      }
    }
    if (!sawDone) {
      yield { type: 'done' };
    }
  } catch (e) {
    if (isAbortError(e) || options?.signal?.aborted) {
      yield { type: 'done' };
      return;
    }
    const message = e instanceof Error ? e.message : 'Stream read failed';
    yield { type: 'error', message };
    yield { type: 'done' };
    return;
  }
}

export async function* streamCommandFromText(
  text: string,
  accessToken: string,
  options?: { signal?: AbortSignal },
): AsyncGenerator<CommandSSEEvent> {
  const url = `${API_BASE_URL}${ENDPOINTS.COMMAND_TEXT}`;
  const form = new FormData();
  form.append('text', text);
  const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (clientTimeZone && clientTimeZone.trim()) {
    form.append('client_timezone', clientTimeZone.trim());
  }
  const sessionToken = getRealtimeSessionToken();
  if (!sessionToken) {
    yield { type: 'error', message: 'Not connected to the assistant service yet' };
    yield { type: 'done' };
    return;
  }
  form.append('session_token', sessionToken);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
      signal: options?.signal,
    });
  } catch (e) {
    if (isAbortError(e) || options?.signal?.aborted) {
      yield { type: 'done' };
      return;
    }
    const message = e instanceof Error ? e.message : 'Network error';
    yield { type: 'error', message };
    yield { type: 'done' };
    return;
  }

  if (!response.ok || !response.body) {
    let detail = `HTTP ${response.status}`;
    try {
      const t = await response.text();
      if (t) {
        try {
          const parsed = JSON.parse(t) as { detail?: unknown };
          if (typeof parsed.detail === 'string') {
            detail = parsed.detail.slice(0, 240);
          } else if (parsed.detail && typeof parsed.detail === 'object') {
            const detailObj = parsed.detail as { message?: unknown; code?: unknown };
            if (typeof detailObj.message === 'string' && typeof detailObj.code === 'string') {
              detail = `${detailObj.code}: ${detailObj.message}`.slice(0, 240);
            } else {
              detail = t.slice(0, 240);
            }
          } else {
            detail = t.slice(0, 240);
          }
        } catch {
          detail = t.slice(0, 240);
        }
      }
    } catch {
      /* ignore */
    }
    yield { type: 'error', message: detail };
    yield { type: 'done' };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const ev = parseDataLine(line);
        if (ev) {
          if (ev.type === 'done') sawDone = true;
          yield ev;
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        const ev = parseDataLine(line);
        if (ev) {
          if (ev.type === 'done') sawDone = true;
          yield ev;
        }
      }
    }
    if (!sawDone) {
      yield { type: 'done' };
    }
  } catch (e) {
    if (isAbortError(e) || options?.signal?.aborted) {
      yield { type: 'done' };
      return;
    }
    const message = e instanceof Error ? e.message : 'Stream read failed';
    yield { type: 'error', message };
    yield { type: 'done' };
    return;
  }
}
