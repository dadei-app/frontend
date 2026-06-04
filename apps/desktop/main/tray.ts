import { app, Menu, Tray, nativeImage, type BrowserWindow } from 'electron';
import path from 'path';
import { setAppQuitting } from './app-quit';
import { getStartup } from './settings-store';

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

export function syncTrayFromSettings(): void {
  const useTray = getStartup().minimizeToTray;
  const canTray = process.platform === 'win32' || process.platform === 'linux';

  if (!useTray || !canTray) {
    destroyTray();
    return;
  }

  if (tray) return;

  const iconPath = path.join(app.getAppPath(), 'resources', 'icon.png');
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    console.warn('[tray] icon missing at', iconPath);
    return;
  }

  tray = new Tray(image.resize({ width: 16, height: 16 }));
  tray.setToolTip('Dadei');
  tray.on('click', () => showMainWindow());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Dadei', click: () => showMainWindow() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          setAppQuitting();
          app.quit();
        },
      },
    ]),
  );
}
