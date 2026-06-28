import { Menu, Tray, type BrowserWindow } from 'electron';
import { buildTrayMenuTemplate } from './menu';
import { resolveTrayIcon } from './app-icon';

export function usesSystemTray(): boolean {
  return process.platform === 'win32' || process.platform === 'linux';
}

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;

export function setTrayMainWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

export function destroyTray(): void {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

async function loadTrayIcon() {
  return resolveTrayIcon();
}

function attachTrayHandlers(icon: NonNullable<ReturnType<typeof resolveTrayIcon>>): void {
  if (tray) {
    tray.setImage(icon);
    tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate(showMainWindow)));
    return;
  }

  tray = new Tray(icon);
  tray.setToolTip('dadei');
  tray.on('click', () => showMainWindow());
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate(showMainWindow)));
}

export async function syncTrayFromSettings(): Promise<void> {
  if (!usesSystemTray()) {
    destroyTray();
    return;
  }

  const image = await loadTrayIcon();
  if (!image) {
    console.warn('[tray] no tray icon available');
    destroyTray();
    return;
  }

  attachTrayHandlers(image);
}
