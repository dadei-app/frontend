import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getMute, getVolume, setMute, setVolume, toggleMute } from 'easy-volume';
import { openApp } from './app-launcher';
import {
  collectDeviceInfo,
  toggleDoNotDisturb,
  type DeviceInfoKey,
} from './device-info';

const execFileAsync = promisify(execFile);

type DeviceResult = { ok: boolean };

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function okResult(ok: boolean): DeviceResult {
  return { ok };
}

function normalizeDeviceInfoKeys(raw: unknown): DeviceInfoKey[] {
  if (!Array.isArray(raw)) return [];
  const keys = new Set<DeviceInfoKey>();
  for (const entry of raw) {
    const key = String(entry).trim().toLowerCase();
    if (key === 'now_playing' || key === 'battery' || key === 'screenshot') {
      keys.add(key);
    }
  }
  return [...keys];
}

async function runCommand(command: string, args: string[] = []): Promise<boolean> {
  try {
    await execFileAsync(command, args, { windowsHide: true });
    return true;
  } catch (error) {
    console.warn('[device-control] command failed', command, args, error);
    return false;
  }
}

async function setSystemVolume(level: number): Promise<boolean> {
  try {
    await setVolume(clampPercent(level));
    return true;
  } catch (error) {
    console.warn('[device-control] setVolume unavailable', error);
    return false;
  }
}

async function stepSystemVolume(delta: number): Promise<boolean> {
  try {
    const current = Number(await getVolume());
    await setVolume(clampPercent(current + delta));
    return true;
  } catch (error) {
    console.warn('[device-control] stepVolume unavailable', error);
    return false;
  }
}

async function toggleSystemMute(): Promise<boolean> {
  try {
    await toggleMute();
    return true;
  } catch (error) {
    try {
      const current = Boolean(await getMute());
      await setMute(!current);
      return true;
    } catch (fallbackError) {
      console.warn('[device-control] toggleMute unavailable', fallbackError);
      return false;
    }
  }
}

async function sendMediaKey(action: 'play_pause' | 'next' | 'previous' | 'stop'): Promise<boolean> {
  if (process.platform === 'win32') {
    const keyMap: Record<typeof action, string> = {
      play_pause: '[char]179',
      next: '[char]176',
      previous: '[char]177',
      stop: '[char]178',
    };
    return runCommand('powershell', [
      '-NoProfile',
      '-Command',
      `(New-Object -ComObject WScript.Shell).SendKeys(${keyMap[action]})`,
    ]);
  }
  if (process.platform === 'darwin') {
    const scriptMap: Record<typeof action, string> = {
      play_pause: 'tell application "System Events" to key code 16',
      next: 'tell application "System Events" to key code 19',
      previous: 'tell application "System Events" to key code 20',
      stop: 'tell application "System Events" to key code 16',
    };
    return runCommand('osascript', ['-e', scriptMap[action]]);
  }
  return runCommand('playerctl', [action === 'play_pause' ? 'play-pause' : action]);
}

async function lockDevice(): Promise<boolean> {
  if (process.platform === 'win32') {
    return runCommand('rundll32.exe', ['user32.dll,LockWorkStation']);
  }
  if (process.platform === 'darwin') {
    return runCommand('pmset', ['displaysleepnow']);
  }
  return runCommand('xdg-screensaver', ['lock']);
}

async function sleepDevice(): Promise<boolean> {
  if (process.platform === 'win32') {
    return runCommand('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']);
  }
  if (process.platform === 'darwin') {
    return runCommand('pmset', ['sleepnow']);
  }
  return runCommand('systemctl', ['suspend']);
}

async function closeFocusedApp(): Promise<boolean> {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    focused.close();
    return true;
  }
  if (process.platform === 'win32') {
    return runCommand('powershell', ['-NoProfile', '-Command', '(New-Object -ComObject WScript.Shell).SendKeys("%{F4}")']);
  }
  if (process.platform === 'darwin') {
    return runCommand('osascript', ['-e', 'tell application "System Events" to keystroke "q" using command down']);
  }
  return runCommand('wmctrl', ['-c', ':ACTIVE:']);
}

async function minimizeFocusedWindow(): Promise<boolean> {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    focused.minimize();
    return true;
  }
  if (process.platform === 'darwin') {
    return runCommand('osascript', ['-e', 'tell application "System Events" to keystroke "m" using command down']);
  }
  return false;
}

async function toggleFullscreen(): Promise<boolean> {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    focused.setFullScreen(!focused.isFullScreen());
    return true;
  }
  return false;
}

async function dismissNotifications(): Promise<boolean> {
  if (process.platform === 'win32') {
    return runCommand('powershell', ['-NoProfile', '-Command', '(New-Object -ComObject WScript.Shell).SendKeys("^{ESC}")']);
  }
  if (process.platform === 'darwin') {
    return runCommand('osascript', ['-e', 'tell application "System Events" to key code 53']);
  }
  return false;
}

function safeHandler(fn: (...args: any[]) => Promise<boolean>) {
  return async (_event: unknown, ...args: any[]): Promise<DeviceResult> => {
    try {
      return okResult(await fn(...args));
    } catch (error) {
      console.warn('[device-control] action failed', error);
      return okResult(false);
    }
  };
}

export function registerDeviceControlIpcHandlers(): void {
  ipcMain.handle('device:set-volume', safeHandler((level: number) => setSystemVolume(level)));
  ipcMain.handle('device:volume-up', safeHandler(() => stepSystemVolume(10)));
  ipcMain.handle('device:volume-down', safeHandler(() => stepSystemVolume(-10)));
  ipcMain.handle('device:volume-mute', safeHandler(() => toggleSystemMute()));
  ipcMain.handle('device:media-play-pause', safeHandler(() => sendMediaKey('play_pause')));
  ipcMain.handle('device:media-next', safeHandler(() => sendMediaKey('next')));
  ipcMain.handle('device:media-previous', safeHandler(() => sendMediaKey('previous')));
  ipcMain.handle('device:media-stop', safeHandler(() => sendMediaKey('stop')));
  ipcMain.handle(
    'device:toggle-dark-mode',
    safeHandler(async () => {
      nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
      return true;
    }),
  );
  ipcMain.handle('device:lock', safeHandler(() => lockDevice()));
  ipcMain.handle('device:sleep', safeHandler(() => sleepDevice()));
  ipcMain.handle('device:open-app', safeHandler((name: string) => openApp(name)));
  ipcMain.handle('device:close-focused-app', safeHandler(() => closeFocusedApp()));
  ipcMain.handle('device:minimize-focused-window', safeHandler(() => minimizeFocusedWindow()));
  ipcMain.handle('device:toggle-fullscreen', safeHandler(() => toggleFullscreen()));
  ipcMain.handle('device:dismiss-notifications', safeHandler(() => dismissNotifications()));
  ipcMain.handle('device:toggle-dnd', safeHandler(() => toggleDoNotDisturb()));
  ipcMain.handle('device:get-info', async (_event, keys: unknown) => {
    const normalized = normalizeDeviceInfoKeys(keys);
    if (normalized.length === 0) return {};
    return collectDeviceInfo(normalized);
  });
}
