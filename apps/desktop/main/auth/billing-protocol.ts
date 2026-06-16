import { BrowserWindow } from 'electron';

/** Must match backend `DADEI_DESKTOP_BILLING_ORIGIN`. */
export const DESKTOP_BILLING_RETURN_ORIGIN = 'dadei://billing';

let getMainWindow: (() => BrowserWindow | null) | null = null;

export function parseBillingReturnUrl(rawUrl: string): { status: string } | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'dadei:' || parsed.hostname !== 'billing') {
      return null;
    }
    if (!parsed.pathname.endsWith('/return')) {
      return null;
    }
    const status = parsed.searchParams.get('status') ?? 'success';
    return { status };
  } catch {
    return null;
  }
}

export function deliverBillingReturn(rawUrl: string): boolean {
  const payload = parseBillingReturnUrl(rawUrl);
  if (!payload) {
    return false;
  }
  const win = getMainWindow?.();
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    win.webContents.send('billing:return', payload);
  }
  return true;
}

export function registerBillingProtocol(getWindow: () => BrowserWindow | null): void {
  getMainWindow = getWindow;
}
