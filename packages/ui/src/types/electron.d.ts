/** Payload for `event: action` webhooks from the backend. */
export interface ActionWebhookPayload {
  id: string;
  action_type: string;
  details: string | null;
  status: string;
  scheduled_time: string | null;
  completed_time: string | null;
  created_at: string;
  updated_at: string;
  person_id: string;
  interaction_id: string;
  conversation_id: string;
  network_id: string;
}

export type Modifier = 'Ctrl' | 'Shift' | 'Alt' | 'Meta';

export interface Hotkey {
  key: string;
  modifiers: Modifier[];
}

/** Desktop-only preferences persisted in the Electron main process. */
export interface DesktopStartupSettings {
  launchAtLogin: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
}

export type DesktopPermissionKind = 'location' | 'microphone' | 'screen';
export type DesktopPermissionStatus =
  | 'granted'
  | 'denied'
  | 'not-determined'
  | 'unsupported';

export type DesktopPermissionsMap = Record<DesktopPermissionKind, DesktopPermissionStatus>;

export interface AudioSettings {
  inputDeviceId: string | null;
  sampleRate: 16000 | 44100 | 48000;
  noiseSuppression: boolean;
  noiseSuppressionLevel: number;
}

export type BootstrapPhase =
  | 'booting'
  | 'checking_server'
  | 'checking_updates'
  | 'downloading'
  | 'install_pending'
  | 'manual_required'
  | 'ready'
  | 'mandatory_failed';

export interface BootstrapStatePayload {
  phase: BootstrapPhase;
  progress?: number;
  message?: string;
  downloadUrl?: string;
  serverVersion?: string;
  appVersion?: string;
}

export interface UpdaterCheckResult {
  status: 'up_to_date' | 'update_available' | 'manual_required' | 'error';
  version?: string;
  downloadUrl?: string;
  error?: string;
}

export interface ElectronAPI {
  platform: NodeJS.Platform;
  windowMinimize: () => Promise<void>;
  windowToggleMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void;

  storeTokens: (accessToken: string, refreshToken: string) => Promise<{ success: boolean; error?: string }>;
  getTokens: () => Promise<{ success: boolean; tokens?: { accessToken: string | null; refreshToken: string | null }; error?: string }>;
  clearTokens: () => Promise<{ success: boolean; error?: string }>;
  hasTokens: () => Promise<{ success: boolean; hasTokens?: boolean; error?: string }>;
  onAppClosing: (callback: () => void) => void;
  onNewInteraction: (callback: (payload: unknown) => void) => () => void;
  onWebhookAction: (callback: (payload: { event?: string; data?: unknown }) => void) => () => void;
  onServiceStatusChanged: (callback: (status: { enabled: boolean }) => void) => () => void;
  loginWithGoogle: () => Promise<{ success: boolean; data?: { code: string; state: string }; error?: string }>;
  storeClientName: (clientName: string) => Promise<{ success: boolean; error?: string }>;
  getClientName: () => Promise<{ success: boolean; clientName?: string; error?: string }>;
  setVolume: (level: number) => Promise<{ ok: boolean }>;
  volumeUp: () => Promise<{ ok: boolean }>;
  volumeDown: () => Promise<{ ok: boolean }>;
  volumeMute: () => Promise<{ ok: boolean }>;
  mediaPlayPause: () => Promise<{ ok: boolean }>;
  mediaNext: () => Promise<{ ok: boolean }>;
  mediaPrevious: () => Promise<{ ok: boolean }>;
  mediaStop: () => Promise<{ ok: boolean }>;
  toggleDarkMode: () => Promise<{ ok: boolean }>;
  lockDevice: () => Promise<{ ok: boolean }>;
  sleepDevice: () => Promise<{ ok: boolean }>;
  openApp: (name: string) => Promise<{ ok: boolean }>;
  closeFocusedApp: () => Promise<{ ok: boolean }>;
  minimizeFocusedWindow: () => Promise<{ ok: boolean }>;
  toggleFullscreen: () => Promise<{ ok: boolean }>;
  dismissNotifications: () => Promise<{ ok: boolean }>;
  toggleDoNotDisturb: () => Promise<{ ok: boolean }>;
  getDeviceInfo: (keys: string[]) => Promise<Record<string, unknown>>;

  appGetVersion?: () => Promise<string>;
  appGetBuildHash?: () => Promise<string | null>;
  openExternal?: (url: string) => Promise<void>;
  onOpenSettingsSection?: (
    callback: (payload: { section: string; action?: string }) => void,
  ) => () => void;
  getBootstrapState?: () => Promise<BootstrapStatePayload>;
  onBootstrapState?: (callback: (payload: BootstrapStatePayload) => void) => () => void;
  updaterManualCheck?: () => Promise<UpdaterCheckResult>;
  audio?: {
    getSettings: () => Promise<AudioSettings>;
    setSettings: (s: Partial<AudioSettings>) => Promise<AudioSettings>;
  };
  startup?: {
    getLaunchAtLogin: () => Promise<boolean>;
    setLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
    getStartMinimized: () => Promise<boolean>;
    setStartMinimized: (enabled: boolean) => Promise<boolean>;
    getMinimizeToTray: () => Promise<boolean>;
    setMinimizeToTray: (enabled: boolean) => Promise<boolean>;
  };
  permissions?: {
    checkAll: () => Promise<DesktopPermissionsMap>;
    check: (kind: DesktopPermissionKind) => Promise<DesktopPermissionStatus>;
    request: (kind: DesktopPermissionKind) => Promise<DesktopPermissionStatus>;
  };
  hotkey?: {
    get: () => Promise<Hotkey>;
    set: (h: Hotkey) => Promise<Hotkey>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
