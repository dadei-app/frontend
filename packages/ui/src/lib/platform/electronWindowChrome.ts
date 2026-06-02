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

/** Windows / Linux frameless window: show custom min / max / close. */
export function needsCustomWindowControls(): boolean {
  return isElectronDesktop() && !isElectronMac();
}

/** Pixel height of `DesktopTitleBarStrip` as CSS length; keep in sync with that component. */
export const DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS = '2rem';
