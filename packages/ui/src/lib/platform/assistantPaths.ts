/** Authenticated assistant shell path (single-page product surface). */
export const ASSISTANT_PATH = '/assistant';

/** SPA route that receives tokens from the API after Google web OAuth. */
export const AUTH_OAUTH_CALLBACK_PATH = '/auth/callback';

/** Where to send the user after tokens are saved (never back to the OAuth callback route). */
export function resolvePostOAuthPath(next: string | null | undefined): string {
  const raw = (next ?? '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return ASSISTANT_PATH;
  }
  const pathOnly = raw.split('?')[0]?.split('#')[0] ?? raw;
  if (pathOnly === AUTH_OAUTH_CALLBACK_PATH || pathOnly === '/login') {
    return ASSISTANT_PATH;
  }
  return raw;
}
