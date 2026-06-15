import { app, BrowserWindow, ipcMain, shell } from 'electron';

/** Must match backend `DADEI_DESKTOP_OAUTH_ORIGIN`. */
export const DESKTOP_OAUTH_RETURN_ORIGIN = 'dadei://oauth';

const OAUTH_FLOW_TIMEOUT_MS = 3 * 60 * 1000;

export type OAuthCallbackParams = {
  access_token?: string;
  refresh_token?: string;
  linked?: string;
  next?: string;
  error?: string;
  error_description?: string;
};

type PendingOAuthFlow = {
  resolve: (params: OAuthCallbackParams) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
};

let pendingFlow: PendingOAuthFlow | null = null;
let coldStartCallback: OAuthCallbackParams | null = null;
let getMainWindow: (() => BrowserWindow | null) | null = null;

function parseOAuthCallbackUrl(rawUrl: string): OAuthCallbackParams | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'dadei:' || parsed.hostname !== 'oauth') {
      return null;
    }
    if (!parsed.pathname.endsWith('/callback')) {
      return null;
    }
    const params = Object.fromEntries(parsed.searchParams.entries()) as OAuthCallbackParams;
    return params;
  } catch {
    return null;
  }
}

function settlePending(params: OAuthCallbackParams): void {
  if (pendingFlow) {
    clearTimeout(pendingFlow.timeout);
    pendingFlow.resolve(params);
    pendingFlow = null;
  } else {
    coldStartCallback = params;
  }
}

export function deliverOAuthCallback(rawUrl: string): boolean {
  const params = parseOAuthCallbackUrl(rawUrl);
  if (!params) {
    return false;
  }
  settlePending(params);
  const win = getMainWindow?.();
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    win.webContents.send('oauth:callback', params);
  }
  return true;
}

export function consumeColdStartOAuthCallback(): OAuthCallbackParams | null {
  const params = coldStartCallback;
  coldStartCallback = null;
  return params;
}

export function registerOAuthProtocol(getWindow: () => BrowserWindow | null): void {
  getMainWindow = getWindow;

  ipcMain.handle('auth:start-oauth-flow', async (_event, loginUrl: string) => {
    if (typeof loginUrl !== 'string' || !loginUrl.startsWith('http')) {
      throw new Error('Invalid OAuth login URL');
    }
    if (pendingFlow) {
      throw new Error('OAuth flow already in progress');
    }

    return await new Promise<OAuthCallbackParams>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingFlow = null;
        reject(new Error('OAuth sign-in timed out'));
      }, OAUTH_FLOW_TIMEOUT_MS);

      pendingFlow = { resolve, reject, timeout };

      void shell.openExternal(loginUrl).catch((err: unknown) => {
        if (pendingFlow) {
          clearTimeout(pendingFlow.timeout);
          pendingFlow = null;
        }
        reject(err instanceof Error ? err : new Error('Failed to open browser'));
      });
    });
  });
}

export function registerDesktopProtocolClient(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('dadei', process.execPath, [process.argv[1]!]);
    }
  } else {
    app.setAsDefaultProtocolClient('dadei');
  }
}

export function extractProtocolUrlFromArgv(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith('dadei://'));
}
