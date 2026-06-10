import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AudioSettings,
  BootstrapStatePayload,
  DesktopPermissionKind,
  DesktopPermissionStatus,
  DesktopPermissionsMap,
  DesktopStartupSettings,
  Hotkey,
  Modifier,
} from '@dadei/ui/types/electron';
import {
  AUDIO_SETTINGS_CHANGED,
  DEFAULT_AUDIO_SETTINGS,
  dispatchAudioSettingsChanged,
  loadAudioSettings,
  persistAudioSettings,
} from '@dadei/ui/lib/audio/audioSettingsEvents';
import {
  enumerateMicInputs,
  micDevicesHaveLabels,
} from '@dadei/ui/lib/audio/micDevices';
import {
  checkElectronMicrophonePermission,
  checkRendererPermission,
  requestElectronMicrophonePermission,
  requestRendererPermission,
} from '@dadei/ui/lib/platform/desktopPermissions';
import {
  DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
  isDesktopTitleBarTarget,
} from '@dadei/ui/lib/platform/electronWindowChrome';

const DEFAULT_HOTKEY: Hotkey = { key: 'Space', modifiers: [] };

const DEFAULT_STARTUP: DesktopStartupSettings = {
  launchAtLogin: false,
  startMinimized: false,
  minimizeToTray: false,
};

const DEFAULT_PERMISSIONS: DesktopPermissionsMap = {
  location: 'not-determined',
  microphone: 'not-determined',
  screen: 'not-determined',
};

const MAC_SYMBOLS: Record<Modifier, string> = {
  Meta: '⌘',
  Alt: '⌥',
  Shift: '⇧',
  Ctrl: '⌃',
};

const KEY_LABELS: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/** Window-chrome strip in the renderer (not app content); used for outside-click guards. */
export const DESKTOP_TITLEBAR_ATTR = 'data-desktop-titlebar';

function keyLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (/^F\d+$/.test(code)) return code;
  return code;
}

type Platform = 'darwin' | 'win32' | 'linux' | 'web';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';
  const apiPlatform = window.electronAPI?.platform;
  if (apiPlatform === 'darwin' || apiPlatform === 'win32' || apiPlatform === 'linux') {
    return apiPlatform;
  }
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad|iPod/i.test(navigator.platform)) return 'darwin';
  if (/Win/i.test(ua)) return 'win32';
  if (/Linux/i.test(ua)) return 'linux';
  return 'web';
}

function readTitleBarOffsetCss(): string {
  const wco = navigator.windowControlsOverlay;
  if (wco?.visible && wco.height > 0) {
    return `${wco.height}px`;
  }
  return DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS;
}

function syncTitleBarCssVars(): void {
  const offset = readTitleBarOffsetCss();
  document.documentElement.style.setProperty('--assistant-titlebar-offset', offset);
  const wco = navigator.windowControlsOverlay;
  if (wco?.visible) {
    document.documentElement.style.setProperty(
      '--desktop-titlebar-controls-width',
      `${wco.width}px`,
    );
  } else {
    document.documentElement.style.removeProperty('--desktop-titlebar-controls-width');
  }
}

interface SystemContextValue {
  isElectron: boolean;
  /** True when running the desktop app on macOS. */
  isMac: boolean;
  platform: Platform;
  /** Full-page layout height class for Electron vs web viewport models. */
  viewportFillClass: string;
  /** Installed app version (desktop IPC); also mirrored on bootstrapState when booting. */
  appVersion: string | null;
  appBuildHash: string | null;
  bootstrapState: BootstrapStatePayload;
  isBootstrapReady: boolean;
  /** CSS length for layout/modals below the OS title-bar region. */
  desktopTitleBarOffset: string;
  /** Desktop startup / window behavior (Electron settings store). */
  startup: DesktopStartupSettings;
  startupLoaded: boolean;
  /** System tray for restore-after-hide is Windows/Linux only; macOS uses the Dock. */
  supportsMinimizeToTray: boolean;
  setLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
  setStartMinimized: (enabled: boolean) => Promise<boolean>;
  setMinimizeToTray: (enabled: boolean) => Promise<boolean>;
  permissions: DesktopPermissionsMap;
  permissionsLoaded: boolean;
  /** Electron needs GOOGLE_API_KEY for Chromium geolocation (dev and packaged). */
  geolocationConfigured: boolean;
  refreshPermissions: () => Promise<void>;
  requestAppPermission: (kind: DesktopPermissionKind) => Promise<DesktopPermissionStatus>;
  hotkey: Hotkey;
  setHotkey: (h: Hotkey) => Promise<void>;
  formatHotkey: (h?: Hotkey) => string;
  matchesHotkey: (event: KeyboardEvent, h?: Hotkey) => boolean;
  audioSettings: AudioSettings;
  updateAudioSettings: (patch: Partial<AudioSettings>) => Promise<AudioSettings>;
  micDevices: MediaDeviceInfo[];
  refreshMicDevices: () => Promise<void>;
  /** Radix Dialog: ignore clicks on window chrome (title bar / WCO drag region). */
  preventDialogDismissOnTitleBar: (event: {
    preventDefault: () => void;
    target: EventTarget | null;
    detail?: { originalEvent: PointerEvent };
  }) => void;
}

const SystemContext = createContext<SystemContextValue | undefined>(undefined);

export function SystemProvider({ children }: { children: ReactNode }) {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const platform = useMemo(() => detectPlatform(), []);
  const isMac = platform === 'darwin';

  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [appBuildHash, setAppBuildHash] = useState<string | null>(null);
  const [bootstrapState, setBootstrapState] = useState<BootstrapStatePayload>({
    phase: isElectron ? 'booting' : 'ready',
  });
  const [startup, setStartup] = useState<DesktopStartupSettings>(DEFAULT_STARTUP);
  const [startupLoaded, setStartupLoaded] = useState(!isElectron);
  const [permissions, setPermissions] = useState<DesktopPermissionsMap>(DEFAULT_PERMISSIONS);
  const [permissionsLoaded, setPermissionsLoaded] = useState(!isElectron);
  const [geolocationConfigured, setGeolocationConfigured] = useState(!isElectron);
  const [hotkey, setHotkeyState] = useState<Hotkey>(DEFAULT_HOTKEY);
  const supportsMinimizeToTray = isElectron && platform !== 'darwin';
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [desktopTitleBarOffset, setDesktopTitleBarOffset] = useState(
    DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
  );
  const titleBarOffsetPxRef = useRef(32);
  const micDevicesRef = useRef(micDevices);
  micDevicesRef.current = micDevices;

  useEffect(() => {
    if (!isElectron) return;
    const apply = () => {
      syncTitleBarCssVars();
      const next = readTitleBarOffsetCss();
      setDesktopTitleBarOffset(next);
      const px = Number.parseFloat(next);
      if (!Number.isNaN(px)) titleBarOffsetPxRef.current = px;
    };
    apply();
    navigator.windowControlsOverlay?.addEventListener('geometrychange', apply);
    return () => {
      navigator.windowControlsOverlay?.removeEventListener('geometrychange', apply);
      document.documentElement.style.removeProperty('--assistant-titlebar-offset');
      document.documentElement.style.removeProperty('--desktop-titlebar-controls-width');
    };
  }, [isElectron]);

  const preventDialogDismissOnTitleBar = useCallback(
    (event: {
      preventDefault: () => void;
      target: EventTarget | null;
      detail?: { originalEvent: PointerEvent };
    }) => {
      if (!isElectron) return;
      if (isDesktopTitleBarTarget(event.target)) {
        event.preventDefault();
        return;
      }
      const y = event.detail?.originalEvent?.clientY;
      if (y != null && y < titleBarOffsetPxRef.current) {
        event.preventDefault();
      }
    },
    [isElectron],
  );

  const viewportFillClass = isElectron ? 'h-full min-h-0' : 'min-h-screen';

  useEffect(() => {
    if (!window.electronAPI?.appGetVersion) return;
    void window.electronAPI.appGetVersion().then(setAppVersion).catch(() => {});
    void window.electronAPI.appGetBuildHash?.().then(setAppBuildHash).catch(() => {});
  }, []);

  useEffect(() => {
    const api = window.electronAPI?.startup;
    if (!api) return;
    let cancelled = false;
    void Promise.all([
      api.getLaunchAtLogin(),
      api.getStartMinimized(),
      api.getMinimizeToTray(),
    ])
      .then(([launchAtLogin, startMinimized, minimizeToTray]) => {
        if (cancelled) return;
        setStartup({ launchAtLogin, startMinimized, minimizeToTray });
        setStartupLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setStartupLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLaunchAtLogin = useCallback(async (enabled: boolean) => {
    const api = window.electronAPI?.startup;
    if (!api) return false;
    const value = await api.setLaunchAtLogin(enabled);
    setStartup(prev => ({ ...prev, launchAtLogin: value }));
    return value;
  }, []);

  const setStartMinimized = useCallback(async (enabled: boolean) => {
    const api = window.electronAPI?.startup;
    if (!api) return false;
    const value = await api.setStartMinimized(enabled);
    setStartup(prev => ({ ...prev, startMinimized: value }));
    return value;
  }, []);

  const setMinimizeToTray = useCallback(async (enabled: boolean) => {
    const api = window.electronAPI?.startup;
    if (!api) return false;
    const value = await api.setMinimizeToTray(enabled);
    setStartup(prev => ({ ...prev, minimizeToTray: value }));
    return value;
  }, []);

  const refreshPermissions = useCallback(async () => {
    const api = window.electronAPI?.permissions;
    if (!api) {
      setPermissionsLoaded(true);
      return;
    }
    try {
      const [mainMap, meta, location, microphone] = await Promise.all([
        api.checkAll(),
        api.getMeta?.() ?? Promise.resolve({ geolocationConfigured: false }),
        checkRendererPermission('location'),
        checkElectronMicrophonePermission(),
      ]);
      setGeolocationConfigured(meta.geolocationConfigured);
      setPermissions({
        ...mainMap,
        location,
        microphone,
      });
      setPermissionsLoaded(true);
    } catch {
      setPermissionsLoaded(true);
    }
  }, []);

  const requestAppPermission = useCallback(
    async (kind: DesktopPermissionKind): Promise<DesktopPermissionStatus> => {
      if (kind === 'location' || kind === 'microphone') {
        try {
          if (kind === 'location') {
            const status = await requestRendererPermission('location', { geolocationConfigured });
            setPermissions(prev => ({ ...prev, location: status }));
            return status;
          }
          const merged = await requestElectronMicrophonePermission();
          setPermissions(prev => ({ ...prev, microphone: merged }));
          return merged;
        } catch {
          return 'denied';
        }
      }

      const api = window.electronAPI?.permissions;
      if (!api) return 'unsupported';
      try {
        const status = await api.request(kind);
        setPermissions(prev => ({ ...prev, [kind]: status }));
        return status;
      } catch {
        return 'denied';
      }
    },
    [geolocationConfigured],
  );

  useEffect(() => {
    if (!window.electronAPI?.permissions) return;
    void refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onBootstrapState) return;
    const api = window.electronAPI;
    if (api.getBootstrapState) {
      void api.getBootstrapState().then(setBootstrapState).catch(() => {});
    }
    return api.onBootstrapState(setBootstrapState);
  }, [isElectron]);

  useEffect(() => {
    if (!window.electronAPI?.hotkey?.get) return;
    void window.electronAPI.hotkey.get().then(setHotkeyState).catch(() => {});
  }, []);

  useEffect(() => {
    void loadAudioSettings().then(setAudioSettings).catch(() => {});
    const onSettingsChanged = (event: Event) => {
      const detail = (event as CustomEvent<AudioSettings>).detail;
      if (detail) setAudioSettings(detail);
    };
    window.addEventListener(AUDIO_SETTINGS_CHANGED, onSettingsChanged);
    return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED, onSettingsChanged);
  }, []);

  const updateAudioSettings = useCallback(async (patch: Partial<AudioSettings>) => {
    const next = await persistAudioSettings(patch);
    setAudioSettings(next);
    dispatchAudioSettingsChanged(next);
    return next;
  }, []);

  const refreshMicDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const skipProbe = micDevicesHaveLabels(micDevicesRef.current);
      const inputs = await enumerateMicInputs(skipProbe);
      setMicDevices(inputs);
    } catch {
      // Leave prior list when re-enumeration fails.
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    const onDeviceChange = () => void refreshMicDevices();
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [refreshMicDevices]);

  const setHotkey = useCallback(async (h: Hotkey) => {
    if (window.electronAPI?.hotkey?.set) {
      const saved = await window.electronAPI.hotkey.set(h);
      setHotkeyState(saved);
      return;
    }
    setHotkeyState(h);
  }, []);

  const formatHotkey = useCallback(
    (h: Hotkey = hotkey) => {
      const order: Modifier[] = ['Ctrl', 'Alt', 'Shift', 'Meta'];
      const parts: string[] = [];
      for (const m of order) {
        if (h.modifiers.includes(m)) parts.push(isMac ? MAC_SYMBOLS[m] : m);
      }
      parts.push(keyLabel(h.key));
      return isMac ? parts.join(' ') : parts.join(' + ');
    },
    [hotkey, isMac],
  );

  const matchesHotkey = useCallback(
    (event: KeyboardEvent, h: Hotkey = hotkey) => {
      if (event.code !== h.key) return false;
      const has = (m: Modifier, on: boolean) => h.modifiers.includes(m) === on;
      return (
        has('Ctrl', event.ctrlKey) &&
        has('Shift', event.shiftKey) &&
        has('Alt', event.altKey) &&
        has('Meta', event.metaKey)
      );
    },
    [hotkey],
  );

  const value = useMemo<SystemContextValue>(
    () => ({
      isElectron,
      isMac,
      platform,
      viewportFillClass,
      appVersion,
      appBuildHash,
      bootstrapState,
      isBootstrapReady: bootstrapState.phase === 'ready',
      desktopTitleBarOffset,
      startup,
      startupLoaded,
      supportsMinimizeToTray,
      setLaunchAtLogin,
      setStartMinimized,
      setMinimizeToTray,
      permissions,
      permissionsLoaded,
      geolocationConfigured,
      refreshPermissions,
      requestAppPermission,
      hotkey,
      setHotkey,
      formatHotkey,
      matchesHotkey,
      audioSettings,
      updateAudioSettings,
      micDevices,
      refreshMicDevices,
      preventDialogDismissOnTitleBar,
    }),
    [
      isElectron,
      isMac,
      platform,
      viewportFillClass,
      appVersion,
      appBuildHash,
      bootstrapState,
      desktopTitleBarOffset,
      startup,
      startupLoaded,
      supportsMinimizeToTray,
      setLaunchAtLogin,
      setStartMinimized,
      setMinimizeToTray,
      permissions,
      permissionsLoaded,
      geolocationConfigured,
      refreshPermissions,
      requestAppPermission,
      hotkey,
      setHotkey,
      formatHotkey,
      matchesHotkey,
      audioSettings,
      updateAudioSettings,
      micDevices,
      refreshMicDevices,
      preventDialogDismissOnTitleBar,
    ],
  );

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used within SystemProvider');
  return ctx;
}
