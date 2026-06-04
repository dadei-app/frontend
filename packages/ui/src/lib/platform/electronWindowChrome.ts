/** Desktop Electron app (renderer has preload API). */
export function isElectronDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.electronAPI);
}

/** macOS: native traffic lights; no in-app window control buttons. */
export function isElectronMac(): boolean {
  if (typeof window === 'undefined') return false;
  return window.electronAPI?.platform === 'darwin';
}

/** Pixel height of `DesktopTitleBarStrip` as CSS length; keep in sync with main TITLE_BAR_HEIGHT. */
export const DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS = '2rem';

/** CSS selector for the fixed window-chrome strip (not part of app layout). */
export const DESKTOP_TITLEBAR_SELECTOR = '[data-desktop-titlebar]';

export function isDesktopTitleBarTarget(target: EventTarget | null): boolean {
  if (!isElectronDesktop() || !target) return false;
  const el = target instanceof Element ? target : null;
  return Boolean(el?.closest(DESKTOP_TITLEBAR_SELECTOR));
}

/**
 * Full-page layout height: Electron pages live inside the title-bar shell — use `h-full`, not `100vh`.
 * Web pages use `min-h-screen` against the document.
 */
export function viewportFillClass(): string {
  return isElectronDesktop() ? 'h-full min-h-0' : 'min-h-screen';
}
