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
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad|iPod/i.test(navigator.platform)) return 'darwin';
  if (/Win/i.test(ua)) return 'win32';
  if (/Linux/i.test(ua)) return 'linux';
  return 'web';
}

interface SystemContextValue {
  isElectron: boolean;
  platform: Platform;
  appVersion: string | null;
  bootstrapState: BootstrapStatePayload;
  isBootstrapReady: boolean;
  hotkey: Hotkey;
  setHotkey: (h: Hotkey) => Promise<void>;
  formatHotkey: (h?: Hotkey) => string;
  matchesHotkey: (event: KeyboardEvent, h?: Hotkey) => boolean;
  audioSettings: AudioSettings;
  updateAudioSettings: (patch: Partial<AudioSettings>) => Promise<AudioSettings>;
  micDevices: MediaDeviceInfo[];
  refreshMicDevices: () => Promise<void>;
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
  const micDevicesRef = useRef(micDevices);
  micDevicesRef.current = micDevices;

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
      hotkey,
      setHotkey,
      formatHotkey,
      matchesHotkey,
      audioSettings,
      updateAudioSettings,
      micDevices,
      refreshMicDevices,
    }),
    [
      isElectron,
      platform,
      appVersion,
      bootstrapState,
      hotkey,
      setHotkey,
      formatHotkey,
      matchesHotkey,
      audioSettings,
      updateAudioSettings,
      micDevices,
      refreshMicDevices,
    ],
  );

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used within SystemProvider');
  return ctx;
}
