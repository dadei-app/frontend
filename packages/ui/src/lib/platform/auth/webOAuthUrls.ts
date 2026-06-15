import { ENDPOINTS } from '@dadei/ui/lib/workspace/api/http/constants';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/runtime/assistantPaths';

function apiOriginPrefix(): string {
  const apiUrl = process.env.API_URL || 'http://localhost:8000';
  const isBeta = process.env.BETA === 'true';
  const prefix = isBeta ? '/api/v2' : '/api/v1';
  return `${apiUrl.replace(/\/$/, '')}${prefix}`;
}

/**
 * Full URL to start OAuth in the browser (server redirect).
 * Web: API redirects to `{spaOrigin}/auth/callback` with tokens or `linked`.
 * Desktop Electron: pass `dadei://oauth` as spaOrigin; API redirects to `dadei://oauth/callback`.
 */
function buildWebOAuthLoginUrl(
  endpoint: string,
  nextPath: string = ASSISTANT_PATH,
  spaOrigin?: string,
  linkToken?: string,
): string {
  const u = new URL(`${apiOriginPrefix()}${endpoint}`);
  u.searchParams.set('next', nextPath);
  if (spaOrigin) {
    u.searchParams.set('spa_origin', spaOrigin);
  }
  if (linkToken) {
    u.searchParams.set('link_token', linkToken);
  }
  return u.toString();
}

export function buildWebGoogleOAuthLoginUrl(
  nextPath: string = ASSISTANT_PATH,
  spaOrigin?: string,
  linkToken?: string,
): string {
  return buildWebOAuthLoginUrl(ENDPOINTS.AUTH_GOOGLE_WEB_LOGIN, nextPath, spaOrigin, linkToken);
}

export function buildWebMicrosoftOAuthLoginUrl(
  nextPath: string = ASSISTANT_PATH,
  spaOrigin?: string,
  linkToken?: string,
): string {
  return buildWebOAuthLoginUrl(ENDPOINTS.AUTH_MICROSOFT_WEB_LOGIN, nextPath, spaOrigin, linkToken);
}

export function buildWebAppleOAuthLoginUrl(
  nextPath: string = ASSISTANT_PATH,
  spaOrigin?: string,
  linkToken?: string,
): string {
  return buildWebOAuthLoginUrl(ENDPOINTS.AUTH_APPLE_WEB_LOGIN, nextPath, spaOrigin, linkToken);
}
