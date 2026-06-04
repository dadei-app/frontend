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
  DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
  isDesktopTitleBarTarget,
  isElectronDesktop,
} from '@dadei/ui/lib/platform/electronWindowChrome';

const DEFAULT_HOTKEY: Hotkey = { key: 'Space', modifiers: [] };

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
  platform: Platform;
  appVersion: string | null;
  bootstrapState: BootstrapStatePayload;
  isBootstrapReady: boolean;
  /** CSS length for layout/modals below the OS title-bar region. */
  desktopTitleBarOffset: string;
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
  const [bootstrapState, setBootstrapState] = useState<BootstrapStatePayload>({
    phase: isElectron ? 'booting' : 'ready',
  });
  const [hotkey, setHotkeyState] = useState<Hotkey>(DEFAULT_HOTKEY);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [desktopTitleBarOffset, setDesktopTitleBarOffset] = useState(
    DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
  );
  const titleBarOffsetPxRef = useRef(32);
  const micDevicesRef = useRef(micDevices);
  micDevicesRef.current = micDevices;

  useEffect(() => {
    if (!isElectronDesktop()) return;
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
  }, []);

  const preventDialogDismissOnTitleBar = useCallback(
    (event: {
      preventDefault: () => void;
      target: EventTarget | null;
      detail?: { originalEvent: PointerEvent };
    }) => {
      if (!isElectronDesktop()) return;
      if (isDesktopTitleBarTarget(event.target)) {
        event.preventDefault();
        return;
      }
      const y = event.detail?.originalEvent?.clientY;
      if (y != null && y < titleBarOffsetPxRef.current) {
        event.preventDefault();
      }
    },
    [],
  );

  useEffect(() => {
    if (!window.electronAPI?.appGetVersion) return;
    void window.electronAPI.appGetVersion().then(setAppVersion).catch(() => {});
  }, []);

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
      platform,
      appVersion,
      bootstrapState,
      isBootstrapReady: bootstrapState.phase === 'ready',
      desktopTitleBarOffset,
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
      platform,
      appVersion,
      bootstrapState,
      desktopTitleBarOffset,
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
