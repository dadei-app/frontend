/** Must match backend `DADEI_DESKTOP_OAUTH_ORIGIN` and Electron protocol handler. */
export const DESKTOP_OAUTH_RETURN_ORIGIN = 'dadei://oauth';

export type DesktopOAuthCallbackParams = {
  access_token?: string;
  refresh_token?: string;
  linked?: string;
  next?: string;
  error?: string;
  error_description?: string;
};
