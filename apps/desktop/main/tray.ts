import { app, Menu, Tray, nativeImage, type BrowserWindow, type NativeImage } from 'electron';
import path from 'path';
import { buildTrayMenuTemplate } from './menu';

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

async function resolveTrayIcon(): Promise<NativeImage> {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(app.getAppPath(), 'resources', 'icon.png'),
  ];

  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      return image.resize({ width: 16, height: 16 });
    }
  }

  try {
    const fromExe = await app.getFileIcon(process.execPath, { size: 'small' });
    if (!fromExe.isEmpty()) {
      return fromExe.resize({ width: 16, height: 16 });
    }
  } catch (error) {
    console.warn('[tray] failed to read icon from executable', error);
  }

  return nativeImage.createEmpty();
}

function attachTrayHandlers(icon: NativeImage): void {
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

  const image = await resolveTrayIcon();
  if (image.isEmpty()) {
    console.warn('[tray] no tray icon available');
    destroyTray();
    return;
  }

  attachTrayHandlers(image);
}
