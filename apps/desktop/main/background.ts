import './env';
import { app, BrowserWindow, dialog, ipcMain, Menu, type WebContents } from 'electron';
import path from 'path';
import { closeUpdaterSplashWindow, createUpdaterSplashWindow } from './updater-window';
import { getBackendVersionGate, isUpdateInstallInProgress, runPackagedStartupFlow } from './updater';
import { TokenStorage } from './auth/token-storage';
import { handleGoogleOAuth } from './auth/oauth-handler';
import { registerDeviceControlIpcHandlers } from './device-control';
import { buildApplicationMenu } from './menu';
import { registerSettingsIpc } from './settings-ipc';
import { getStartup } from './settings-store';

const isDev = process.env.NODE_ENV === 'development';

/** Dev: local Vite dev server for the desktop renderer (port must match renderer/vite.config.ts). */
const RENDERER_DEV_PORT = process.env.RENDERER_DEV_PORT || '59247';
const RENDERER_DEV_URL = `http://localhost:${RENDERER_DEV_PORT}`;

let mainWindow: BrowserWindow | null = null;

const isDarwin = process.platform === 'darwin';

function windowFromContents(contents: WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(contents) ?? null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    ...(isDarwin
      ? {
          titleBarStyle: 'hiddenInset' as const,
          // Align with our slim title strip (see DesktopTitleBarStrip mac height).
          trafficLightPosition: { x: 16, y: 8.5 },
        }
      : { frame: false }),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', false);
  });

  if (isDev) {
    mainWindow.loadURL(RENDERER_DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }

  mainWindow.on('close', event => {
    if (
      process.platform !== 'darwin' &&
      getStartup().minimizeToTray &&
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const isMacOrLinux = process.platform === 'darwin' || process.platform === 'linux';
  if (!isMacOrLinux) {
    mainWindow.setMenuBarVisibility(false);
  }
}

ipcMain.handle('auth:store-tokens', async (_, accessToken: string, refreshToken: string) => {
  try {
    await TokenStorage.storeTokens(accessToken, refreshToken);
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error storing tokens:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:get-tokens', async () => {
  try {
    const tokens = await TokenStorage.getTokens();
    return { success: true, tokens };
  } catch (error: any) {
    console.error('[IPC] Error getting tokens:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:clear-tokens', async () => {
  try {
    await TokenStorage.clearTokens();
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error clearing tokens:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:has-tokens', async () => {
  try {
    const hasTokens = await TokenStorage.hasTokens();
    return { success: true, hasTokens };
  } catch (error: any) {
    console.error('[IPC] Error checking tokens:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:google-oauth', async () => {
  try {
    const result = await handleGoogleOAuth();
    return { success: true, data: result };
  } catch (error: any) {
    console.error('[IPC] Google OAuth error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('client:store-name', async (_, clientName: string) => {
  try {
    await TokenStorage.storeClientName(clientName);
    console.log(`[IPC] Client name stored: ${clientName}`);
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error storing client name:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('client:get-name', async () => {
  try {
    const clientName = await TokenStorage.getClientName();
    return { success: true, clientName };
  } catch (error: any) {
    console.error('[IPC] Error getting client name:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('window:minimize', (event) => {
  windowFromContents(event.sender)?.minimize();
});

ipcMain.handle('window:toggle-maximize', (event) => {
  const win = windowFromContents(event.sender);
  if (!win) return false;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
  return win.isMaximized();
});

ipcMain.handle('window:close', (event) => {
  windowFromContents(event.sender)?.close();
});

ipcMain.handle('window:is-maximized', (event) => {
  return windowFromContents(event.sender)?.isMaximized() ?? false;
});

registerDeviceControlIpcHandlers();

app.whenReady().then(async () => {
  registerSettingsIpc();
  const menu = buildApplicationMenu();
  Menu.setApplicationMenu(menu ?? null);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  if (!app.isPackaged) {
    const gate = await getBackendVersionGate();
    if (gate.mandatoryMismatch) {
      dialog.showErrorBox(
        'Update required',
        `This build (v${app.getVersion()}) is not compatible with the server (${gate.serverVersion ?? 'unknown'}). Align the desktop version with the server major version.`,
      );
      app.quit();
      return;
    }
    createWindow();
    return;
  }

  await createUpdaterSplashWindow();
  const outcome = await runPackagedStartupFlow();

  if (outcome === 'launch_main') {
    closeUpdaterSplashWindow();
    createWindow();
    return;
  }

  if (outcome === 'quit_for_install') {
    return;
  }

  // quit_manual: splash stays open with Open releases / Quit until the user exits.
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (isUpdateInstallInProgress()) {
    return;
  }

  event.preventDefault();

  const forceQuitTimeout = setTimeout(() => {
    console.warn('Cleanup timed out, forcing exit...');
    app.exit(0);
  }, 4000);

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-closing');
    }
  } catch (e) {
    console.error('Error during cleanup:', e);
  } finally {
    clearTimeout(forceQuitTimeout);
    console.log('Cleanup complete, quitting.');
    app.exit(0);
  }
});
