/** Authenticated assistant shell path (single-page product surface). */
export const ASSISTANT_PATH = '/assistant';

/** SPA route that receives tokens from the API after Google web OAuth. */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

/** Query param preserved briefly on assistant return after OAuth account linking (web). */
export const OAUTH_LINKED_QUERY = 'oauth_linked';

/** Query param on `ASSISTANT_PATH` that reopens settings to a sidebar section after external flows. */
export const SETTINGS_RETURN_QUERY = 'settings';

export const SETTINGS_SIDEBAR_SECTIONS = [
  'integrations',
  'memories',
  'account',
  'audio',
  'startup',
  'subscription',
  'about',
] as const;

export type SettingsSidebarSection = (typeof SETTINGS_SIDEBAR_SECTIONS)[number];

export function isSettingsSidebarSection(value: string): value is SettingsSidebarSection {
  return (SETTINGS_SIDEBAR_SECTIONS as readonly string[]).includes(value);
}

/** Post-OAuth / post-checkout return URL that reopens settings on the given section (web). */
export function settingsReturnPath(section: SettingsSidebarSection): string {
  const params = new URLSearchParams({ [SETTINGS_RETURN_QUERY]: section });
  return `${ASSISTANT_PATH}?${params.toString()}`;
}

export function parseSettingsSectionFromNext(
  next: string | null | undefined,
): SettingsSidebarSection | null {
  const raw = (next ?? '').trim();
  if (!raw) return null;
  try {
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    const section = new URL(path, 'https://dadei.local').searchParams.get(SETTINGS_RETURN_QUERY);
    if (section && isSettingsSidebarSection(section)) {
      return section;
    }
  } catch {
    /* ignore malformed next */
  }
  return null;
}

/** Where to send the user after tokens are saved (never back to the OAuth callback route). */
export function resolvePostOAuthPath(next: string | null | undefined): string {
  const raw = (next ?? '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return ASSISTANT_PATH;
  }
  const pathOnly = raw.split('?')[0]?.split('#')[0] ?? raw;
  if (pathOnly === OAUTH_CALLBACK_PATH || pathOnly === '/login') {
    return ASSISTANT_PATH;
  }
  return raw;
}
