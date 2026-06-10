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
  toggleDarkMode: () => ipcRenderer.invoke('device:toggle-dark-mode'),
  lockDevice: () => ipcRenderer.invoke('device:lock'),
  sleepDevice: () => ipcRenderer.invoke('device:sleep'),
  openApp: (name: string) => ipcRenderer.invoke('device:open-app', name),
  closeFocusedApp: () => ipcRenderer.invoke('device:close-focused-app'),
  minimizeFocusedWindow: () => ipcRenderer.invoke('device:minimize-focused-window'),
  toggleFullscreen: () => ipcRenderer.invoke('device:toggle-fullscreen'),
  dismissNotifications: () => ipcRenderer.invoke('device:dismiss-notifications'),
  toggleDoNotDisturb: () => ipcRenderer.invoke('device:toggle-dnd'),
  getDeviceInfo: (keys: string[]) => ipcRenderer.invoke('device:get-info', keys),

  appGetVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  appGetBuildHash: () => ipcRenderer.invoke('app:get-build-hash') as Promise<string | null>,
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url) as Promise<void>,

  onOpenSettingsSection: (callback: (payload: { section: string; action?: string }) => void) => {
    const listener = (_e: unknown, payload: { section: string; action?: string }) => callback(payload);
    ipcRenderer.on('app:open-settings-section', listener);
    return () => {
      ipcRenderer.removeListener('app:open-settings-section', listener);
    };
  },

  getBootstrapState: () =>
    ipcRenderer.invoke('bootstrap:get-state') as Promise<Record<string, unknown>>,

  onBootstrapState: (callback: (payload: Record<string, unknown>) => void) => {
    const listener = (_e: unknown, payload: Record<string, unknown>) => callback(payload);
    ipcRenderer.on('app:bootstrap-state', listener);
    return () => {
      ipcRenderer.removeListener('app:bootstrap-state', listener);
    };
  },

  updaterManualCheck: () => ipcRenderer.invoke('updater:manual-check'),

  audio: {
    getSettings: () => ipcRenderer.invoke('audio:get-settings'),
    setSettings: (s: Record<string, unknown>) => ipcRenderer.invoke('audio:set-settings', s),
  },

  startup: {
    getLaunchAtLogin: () => ipcRenderer.invoke('startup:get-launch-at-login') as Promise<boolean>,
    setLaunchAtLogin: (enabled: boolean) =>
      ipcRenderer.invoke('startup:set-launch-at-login', enabled) as Promise<boolean>,
    getStartMinimized: () => ipcRenderer.invoke('startup:get-start-minimized') as Promise<boolean>,
    setStartMinimized: (enabled: boolean) =>
      ipcRenderer.invoke('startup:set-start-minimized', enabled) as Promise<boolean>,
    getMinimizeToTray: () => ipcRenderer.invoke('startup:get-minimize-to-tray') as Promise<boolean>,
    setMinimizeToTray: (enabled: boolean) =>
      ipcRenderer.invoke('startup:set-minimize-to-tray', enabled) as Promise<boolean>,
  },

  permissions: {
    getMeta: () => ipcRenderer.invoke('permissions:get-meta'),
    checkAll: () => ipcRenderer.invoke('permissions:check-all'),
    check: (kind: string) => ipcRenderer.invoke('permissions:check', kind),
    request: (kind: string) => ipcRenderer.invoke('permissions:request', kind),
    checkTutorial: (kind: string) => ipcRenderer.invoke('permissions:check-tutorial', kind),
    openTutorialSettings: (kind: string) =>
      ipcRenderer.invoke('permissions:open-tutorial-settings', kind),
  },

  hotkey: {
    get: () => ipcRenderer.invoke('hotkey:get'),
    set: (h: Record<string, unknown>) => ipcRenderer.invoke('hotkey:set', h),
  },
});