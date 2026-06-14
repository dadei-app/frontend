/**
 * Map API, stream, and WebSocket errors to short user-facing copy (no vendor dumps).
 */

import { isAxiosError } from 'axios';

export const ERROR_CODES = {
  invalid_session: 'Connect to the assistant service and try again.',
  command_mode_not_owner: 'Another device is using the assistant session right now.',
  command_mode_owned: 'The assistant session is already active on another device.',
  service_disabled: 'Turn on the assistant service in settings, then try again.',
  network_not_found: 'Your workspace could not be found. Sign in again.',
  validation_error: 'That request was not valid. Check your input and try again.',
  request_failed: 'Something went wrong. Please try again.',
  rate_limited:
    'The assistant AI is unavailable right now (API quota or billing). ' +
    'Check your Gemini API credits in Google AI Studio and try again.',
  service_unavailable: 'The assistant AI is temporarily overloaded. Please try again shortly.',
  internal_error: 'Something went wrong on our side. Please try again.',
  no_response: 'The assistant did not respond. Please try again.',
  duplicate_command: 'That command was already sent.',
  empty_query: 'Say or type a command first.',
  no_speech: 'No speech was detected. Try again.',
  gemini_unavailable: 'The assistant AI is not configured. Try again later.',
  tool_reply_failed: 'I completed the lookup but could not phrase the result. Please try again.',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

type ApiDetailObject = {
  code?: unknown;
  message?: unknown;
  owner_session_id?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function messageForCode(code: string, override?: string): string {
  const known = ERROR_CODES[code as ErrorCode];
  const trimmed = override?.trim();
  if (known && (!trimmed || trimmed === code)) {
    return known;
  }
  if (trimmed) return sanitizeTechnicalMessage(trimmed);
  if (known) return known;
  return ERROR_CODES.request_failed;
}

/** Strip vendor JSON / stack-like blobs from a message string. */
export function sanitizeTechnicalMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return ERROR_CODES.request_failed;
  if (/429|resource_exhausted|depleted|quota|billing/i.test(trimmed)) {
    return ERROR_CODES.rate_limited;
  }
  if (
    /\b503\b/i.test(trimmed) ||
    /temporarily overloaded/i.test(trimmed) ||
    /service unavailable/i.test(trimmed) ||
    /model is overloaded/i.test(trimmed)
  ) {
    return ERROR_CODES.service_unavailable;
  }
  if (/timeout|timed out/i.test(trimmed)) {
    return 'The request took too long. Please try again.';
  }
  if (/ClientError|RESOURCE_EXHAUSTED|status_code|"error"\s*:\s*\{/i.test(trimmed)) {
    return ERROR_CODES.request_failed;
  }
  if (trimmed.length > 280) return `${trimmed.slice(0, 277)}…`;
  return trimmed;
}

export function parseApiDetail(detail: unknown): { code: string; message: string } {
  if (typeof detail === 'string' && detail.trim()) {
    const text = detail.trim();
    if (text in ERROR_CODES) {
      return { code: text, message: messageForCode(text) };
    }
    return { code: 'request_failed', message: sanitizeTechnicalMessage(text) };
  }
  if (isRecord(detail)) {
    const obj = detail as ApiDetailObject;
    const code = typeof obj.code === 'string' && obj.code.trim() ? obj.code.trim() : 'request_failed';
    const rawMessage = typeof obj.message === 'string' ? obj.message.trim() : '';
    if (code in ERROR_CODES) {
      return { code, message: messageForCode(code) };
    }
    if (rawMessage) {
      return { code, message: sanitizeTechnicalMessage(rawMessage) };
    }
    return { code, message: messageForCode(code) };
  }
  if (Array.isArray(detail)) {
    return { code: 'validation_error', message: ERROR_CODES.validation_error };
  }
  return { code: 'request_failed', message: ERROR_CODES.request_failed };
}

export function parseHttpResponseBody(body: unknown, status?: number): string {
  if (isRecord(body) && 'detail' in body) {
    return parseApiDetail(body.detail).message;
  }
  if (status === 401) return 'You are not signed in. Sign in and try again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return ERROR_CODES.network_not_found;
  if (status === 409) return ERROR_CODES.command_mode_not_owner;
  if (status === 422) return ERROR_CODES.validation_error;
  if (status === 429) return ERROR_CODES.rate_limited;
  if (status && status >= 500) return ERROR_CODES.internal_error;
  return ERROR_CODES.request_failed;
}

/** Primary helper: unknown thrown value → user-facing sentence. */
export function getUserErrorMessage(
  error: unknown,
  fallback: string = ERROR_CODES.request_failed,
): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    if (data !== undefined) {
      return parseHttpResponseBody(data, status);
    }
    if (error.message?.trim()) {
      return sanitizeTechnicalMessage(error.message);
    }
  }
  if (isRecord(error) && 'detail' in error) {
    return parseApiDetail(error.detail).message;
  }
  if (error instanceof Error && error.message.trim()) {
    return sanitizeTechnicalMessage(error.message);
  }
  if (typeof error === 'string' && error.trim()) {
    return sanitizeTechnicalMessage(error);
  }
  return fallback;
}

export function formatCommandStreamError(message: string, code?: string): string {
  if (code && code in ERROR_CODES) {
    return messageForCode(code);
  }
  return sanitizeTechnicalMessage(message);
}

export function formatWsTranscriptError(payload: {
  code?: unknown;
  message?: unknown;
}): string {
  const code = typeof payload.code === 'string' ? payload.code.trim() : undefined;
  const message = typeof payload.message === 'string' ? payload.message.trim() : undefined;
  if (code && code in ERROR_CODES) {
    return ERROR_CODES[code as ErrorCode];
  }
  if (code) return messageForCode(code, message);
  if (message) return sanitizeTechnicalMessage(message);
  return ERROR_CODES.request_failed;
}

/** Tool JSON summary → short bubble line (errors sanitized). */
export function formatToolResultUserMessage(summary: string, ok: boolean): string {
  if (!summary.trim()) return ok ? '' : ERROR_CODES.request_failed;
  try {
    const parsed = JSON.parse(summary) as Record<string, unknown>;
    if (!ok) {
      const err = parsed.error;
      if (typeof err === 'string' && err.trim()) {
        return sanitizeTechnicalMessage(err);
      }
      return ERROR_CODES.request_failed;
    }
  } catch {
    if (!ok) return ERROR_CODES.request_failed;
  }
  return '';
}
