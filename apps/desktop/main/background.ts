import './env';
import { configureGeolocationApiKey } from './geolocation-config';

configureGeolocationApiKey();
import { app, BrowserWindow, dialog, ipcMain, Menu, type WebContents } from 'electron';
import path from 'path';
import {
  emitBootstrapState,
  getBackendVersionGate,
  getLastBootstrapState,
  isUpdateInstallInProgress,
  replayBootstrapState,
  runPackagedStartupFlow,
} from './updater';
import { TokenStorage } from './auth/token-storage';
import { handleGoogleOAuth } from './auth/oauth-handler';
import { registerDeviceControlIpcHandlers } from './device-control';
import { buildApplicationMenu } from './menu';
import { isAppQuitting, setAppQuitting } from './app-quit';
import { registerSettingsIpc } from './settings-ipc';
import { configureSessionPermissions } from './session-permissions';
import { getStartup } from './settings-store';
import { setTrayMainWindow, syncTrayFromSettings } from './tray';

const isDev = process.env.NODE_ENV === 'development';

/** Dev: local Vite dev server for the desktop renderer (port must match renderer/vite.config.ts). */
const RENDERER_DEV_PORT = process.env.RENDERER_DEV_PORT || '59247';
const RENDERER_DEV_URL = `http://127.0.0.1:${RENDERER_DEV_PORT}`;

let mainWindow: BrowserWindow | null = null;

const isDarwin = process.platform === 'darwin';

/** Match renderer title strip + Electron titleBarOverlay.height (win32/linux). */
const TITLE_BAR_HEIGHT = 32;

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
          trafficLightPosition: { x: 16, y: 8.5 },
        }
      : {
          // Window Controls Overlay: native min/max/close; renderer draws drag strip only.
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#09090b',
            symbolColor: '#a1a1aa',
            height: TITLE_BAR_HEIGHT,
          },
        }),
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

  mainWindow.webContents.on('did-finish-load', () => {
    replayBootstrapState();
  });

  if (isDev) {
    mainWindow.loadURL(RENDERER_DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }

  setTrayMainWindow(mainWindow);

  mainWindow.on('close', event => {
    if (
      !isAppQuitting() &&
      getStartup().minimizeToTray &&
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    setTrayMainWindow(null);
    mainWindow = null;
  });

  if (getStartup().startMinimized && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }

  syncTrayFromSettings();

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

ipcMain.handle('bootstrap:get-state', () => getLastBootstrapState());

app.whenReady().then(async () => {
  configureSessionPermissions();

  const menu = buildApplicationMenu();
  Menu.setApplicationMenu(menu ?? null);

  registerSettingsIpc();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  if (!app.isPackaged) {
    emitBootstrapState({ phase: 'ready', appVersion: app.getVersion() });
    void (async () => {
      const gate = await getBackendVersionGate();
      if (gate.mandatoryMismatch) {
        dialog.showErrorBox(
          'Update required',
          `This build (v${app.getVersion()}) is not compatible with the server (${gate.serverVersion ?? 'unknown'}). Align the desktop version with the server major version.`,
        );
        app.quit();
      }
    })();
    return;
  }

  emitBootstrapState({ phase: 'booting', appVersion: app.getVersion() });

  void runPackagedStartupFlow();
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

  setAppQuitting();
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
