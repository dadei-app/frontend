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
  onNewInteraction: (callback: (payload: any) => void) => () => void;
  onWebhookAction: (callback: (payload: { event?: string; data?: ActionWebhookPayload }) => void) => () => void;
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
  setBrightness: (level: number) => Promise<{ ok: boolean }>;
  brightnessUp: () => Promise<{ ok: boolean }>;
  brightnessDown: () => Promise<{ ok: boolean }>;
  toggleDarkMode: () => Promise<{ ok: boolean }>;
  lockDevice: () => Promise<{ ok: boolean }>;
  sleepDevice: () => Promise<{ ok: boolean }>;
  openApp: (name: string) => Promise<{ ok: boolean }>;
  closeFocusedApp: () => Promise<{ ok: boolean }>;
  minimizeFocusedWindow: () => Promise<{ ok: boolean }>;
  toggleFullscreen: () => Promise<{ ok: boolean }>;
  dismissNotifications: () => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}