import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type DeviceResult = { ok: boolean };

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function okResult(ok: boolean): DeviceResult {
  return { ok };
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

async function withLoudness<T>(fn: (loudness: any) => Promise<T>): Promise<T | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loudness = require('loudness');
    return await fn(loudness);
  } catch (error) {
    console.warn('[device-control] loudness unavailable', error);
    return null;
  }
}

async function withBrightness<T>(fn: (brightness: any) => Promise<T>): Promise<T | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const brightness = require('brightness');
    return await fn(brightness);
  } catch (error) {
    console.warn('[device-control] brightness unavailable', error);
    return null;
  }
}

async function setVolume(level: number): Promise<boolean> {
  const clamped = clampPercent(level);
  const result = await withLoudness(async (loudness) => {
    await loudness.setVolume(clamped);
    return true;
  });
  return result === true;
}

async function stepVolume(delta: number): Promise<boolean> {
  const result = await withLoudness(async (loudness) => {
    const current = Number(await loudness.getVolume());
    await loudness.setVolume(clampPercent(current + delta));
    return true;
  });
  return result === true;
}

async function toggleMute(): Promise<boolean> {
  const result = await withLoudness(async (loudness) => {
    const current = Boolean(await loudness.getMuted());
    await loudness.setMuted(!current);
    return true;
  });
  return result === true;
}

async function setBrightness(level: number): Promise<boolean> {
  const clamped = clampPercent(level) / 100;
  const result = await withBrightness(async (brightness) => {
    await brightness.set(clamped);
    return true;
  });
  return result === true;
}

async function stepBrightness(delta: number): Promise<boolean> {
  const result = await withBrightness(async (brightness) => {
    const current = Number(await brightness.get()) * 100;
    await brightness.set(clampPercent(current + delta) / 100);
    return true;
  });
  return result === true;
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

async function openApp(name: string): Promise<boolean> {
  const target = name.trim();
  if (!target) return false;
  if (process.platform === 'win32') {
    return runCommand('powershell', ['-NoProfile', '-Command', `Start-Process "${target.replace(/"/g, '\\"')}"`]);
  }
  if (process.platform === 'darwin') {
    return runCommand('open', ['-a', target]);
  }
  return runCommand('xdg-open', [target]);
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
  ipcMain.handle('device:set-volume', safeHandler((level: number) => setVolume(level)));
  ipcMain.handle('device:volume-up', safeHandler(() => stepVolume(10)));
  ipcMain.handle('device:volume-down', safeHandler(() => stepVolume(-10)));
  ipcMain.handle('device:volume-mute', safeHandler(() => toggleMute()));
  ipcMain.handle('device:media-play-pause', safeHandler(() => sendMediaKey('play_pause')));
  ipcMain.handle('device:media-next', safeHandler(() => sendMediaKey('next')));
  ipcMain.handle('device:media-previous', safeHandler(() => sendMediaKey('previous')));
  ipcMain.handle('device:media-stop', safeHandler(() => sendMediaKey('stop')));
  ipcMain.handle('device:set-brightness', safeHandler((level: number) => setBrightness(level)));
  ipcMain.handle('device:brightness-up', safeHandler(() => stepBrightness(10)));
  ipcMain.handle('device:brightness-down', safeHandler(() => stepBrightness(-10)));
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
}
