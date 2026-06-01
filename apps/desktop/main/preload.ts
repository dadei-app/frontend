import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<boolean>,
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: unknown, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window:maximized-changed', listener);
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', listener);
    };
  },

  // Token storage
  storeTokens: (accessToken: string, refreshToken: string) =>
    ipcRenderer.invoke('auth:store-tokens', accessToken, refreshToken),

  getTokens: () =>
    ipcRenderer.invoke('auth:get-tokens'),

  clearTokens: () =>
    ipcRenderer.invoke('auth:clear-tokens'),

  hasTokens: () =>
    ipcRenderer.invoke('auth:has-tokens'),

  // App lifecycle
  onAppClosing: (callback: () => void) =>
    ipcRenderer.on('app-closing', callback),

  onNewInteraction: (callback: (payload: any) => void) => {
    const listener = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on('new-interaction', listener);

    return () => {
      ipcRenderer.removeListener('new-interaction', listener);
    };
  },

  onWebhookAction: (callback: (payload: any) => void) => {
    const listener = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on('webhook-action', listener);

    return () => {
      ipcRenderer.removeListener('webhook-action', listener);
    };
  },

  onServiceStatusChanged: (callback: (status: any) => void) => {
    const listener = (_event: any, status: any) => callback(status);
    ipcRenderer.on('service-status-changed', listener);

    return () => {
      ipcRenderer.removeListener('service-status-changed', listener);
    };
  },

  // OAuth
  loginWithGoogle: () => ipcRenderer.invoke('auth:google-oauth'),

  // Client name
  storeClientName: (clientName: string) => ipcRenderer.invoke('client:store-name', clientName),
  getClientName: () => ipcRenderer.invoke('client:get-name'),

  // Device control
  setVolume: (level: number) => ipcRenderer.invoke('device:set-volume', level),
  volumeUp: () => ipcRenderer.invoke('device:volume-up'),
  volumeDown: () => ipcRenderer.invoke('device:volume-down'),
  volumeMute: () => ipcRenderer.invoke('device:volume-mute'),
  mediaPlayPause: () => ipcRenderer.invoke('device:media-play-pause'),
  mediaNext: () => ipcRenderer.invoke('device:media-next'),
  mediaPrevious: () => ipcRenderer.invoke('device:media-previous'),
  mediaStop: () => ipcRenderer.invoke('device:media-stop'),
  setBrightness: (level: number) => ipcRenderer.invoke('device:set-brightness', level),
  brightnessUp: () => ipcRenderer.invoke('device:brightness-up'),
  brightnessDown: () => ipcRenderer.invoke('device:brightness-down'),
  toggleDarkMode: () => ipcRenderer.invoke('device:toggle-dark-mode'),
  lockDevice: () => ipcRenderer.invoke('device:lock'),
  sleepDevice: () => ipcRenderer.invoke('device:sleep'),
  openApp: (name: string) => ipcRenderer.invoke('device:open-app', name),
  closeFocusedApp: () => ipcRenderer.invoke('device:close-focused-app'),
  minimizeFocusedWindow: () => ipcRenderer.invoke('device:minimize-focused-window'),
  toggleFullscreen: () => ipcRenderer.invoke('device:toggle-fullscreen'),
  dismissNotifications: () => ipcRenderer.invoke('device:dismiss-notifications'),
});