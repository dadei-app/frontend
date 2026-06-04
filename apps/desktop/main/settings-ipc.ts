import { app, ipcMain, shell } from 'electron';
import {
  checkAllPermissions,
  checkPermission,
  requestPermission,
  type PermissionKind,
} from './permissions';
import {
  getAudio,
  getHotkey,
  getStartup,
  setAudio,
  setHotkey,
  setStartupField,
} from './settings-store';
import { isGeolocationApiKeyConfigured } from './geolocation-config';
import { syncTrayFromSettings } from './tray';
import { manualUpdaterCheck } from './updater';

export function registerSettingsIpc(): void {
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-build-hash', () => process.env.BUILD_HASH ?? null);

  ipcMain.handle('app:open-external', async (_e, url: string) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      await shell.openExternal(url);
    }
  });

  ipcMain.handle('audio:get-settings', () => getAudio());
  ipcMain.handle('audio:set-settings', (_e, patch) => setAudio(patch ?? {}));

  ipcMain.handle('startup:get-launch-at-login', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('startup:set-launch-at-login', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    setStartupField('launchAtLogin', enabled);
    return enabled;
  });
  ipcMain.handle('startup:get-start-minimized', () => getStartup().startMinimized);
  ipcMain.handle('startup:set-start-minimized', (_e, enabled: boolean) => {
    setStartupField('startMinimized', enabled);
    return enabled;
  });
  ipcMain.handle('startup:get-minimize-to-tray', () => getStartup().minimizeToTray);
  ipcMain.handle('startup:set-minimize-to-tray', (_e, enabled: boolean) => {
    setStartupField('minimizeToTray', enabled);
    syncTrayFromSettings();
    return enabled;
  });

  ipcMain.handle('permissions:get-meta', () => ({
    geolocationConfigured: isGeolocationApiKeyConfigured(),
  }));
  ipcMain.handle('permissions:check-all', () => checkAllPermissions());
  ipcMain.handle('permissions:check', (_e, kind: PermissionKind) => checkPermission(kind));
  ipcMain.handle('permissions:request', (_e, kind: PermissionKind) => requestPermission(kind));

  ipcMain.handle('hotkey:get', () => getHotkey());
  ipcMain.handle('hotkey:set', (_e, h) => setHotkey(h));

  ipcMain.handle('updater:manual-check', () => manualUpdaterCheck());
}
