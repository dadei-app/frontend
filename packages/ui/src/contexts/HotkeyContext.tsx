import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Hotkey, Modifier } from '@dadei/ui/types/electron';

const DEFAULT_HOTKEY: Hotkey = { key: 'Space', modifiers: [] };

interface HotkeyContextValue {
  hotkey: Hotkey;
  setHotkey: (h: Hotkey) => Promise<void>;
  formatHotkey: (h?: Hotkey) => string;
  matchesHotkey: (event: KeyboardEvent, h?: Hotkey) => boolean;
}

const HotkeyContext = createContext<HotkeyContextValue | undefined>(undefined);

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
  if (code.startsWith('F') && /^F\d+$/.test(code)) return code;
  return code;
}

export function HotkeyProvider({ children }: { children: ReactNode }) {
  const [hotkey, setHotkeyState] = useState<Hotkey>(DEFAULT_HOTKEY);
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

  useEffect(() => {
    if (!window.electronAPI?.hotkey?.get) return;
    void window.electronAPI.hotkey.get().then(setHotkeyState).catch(() => {});
  }, []);

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
        if (h.modifiers.includes(m)) {
          parts.push(isMac ? MAC_SYMBOLS[m] : m);
        }
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

  return (
    <HotkeyContext.Provider value={{ hotkey, setHotkey, formatHotkey, matchesHotkey }}>
      {children}
    </HotkeyContext.Provider>
  );
}

export function useHotkey() {
  const ctx = useContext(HotkeyContext);
  if (!ctx) throw new Error('useHotkey must be used within HotkeyProvider');
  return ctx;
}
