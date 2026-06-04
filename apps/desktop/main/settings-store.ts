import Store from 'electron-store';

const DEFAULTS = {
  audio: {
    inputDeviceId: null as string | null,
    sampleRate: 16000 as 16000 | 44100 | 48000,
    noiseSuppression: true,
    noiseSuppressionLevel: 50,
  },
  startup: {
    launchAtLogin: false,
    startMinimized: false,
    minimizeToTray: false,
  },
  hotkey: {
    key: 'Space',
    modifiers: [] as ('Ctrl' | 'Shift' | 'Alt' | 'Meta')[],
  },
};

export type StoredHotkey = (typeof DEFAULTS)['hotkey'];
export type StoredAudio = (typeof DEFAULTS)['audio'];
export type StoredStartup = (typeof DEFAULTS)['startup'];

export const settingsStore = new Store({
  name: 'user-settings',
  defaults: DEFAULTS,
});

export function getAudio(): StoredAudio {
  return settingsStore.get('audio');
}

export function setAudio(patch: Partial<StoredAudio>): StoredAudio {
  const cur = getAudio();
  const next = { ...cur, ...patch };
  settingsStore.set('audio', next);
  return next;
}

export function getStartup(): StoredStartup {
  return settingsStore.get('startup');
}

export function setStartupField<K extends keyof StoredStartup>(
  key: K,
  value: StoredStartup[K],
): StoredStartup[K] {
  settingsStore.set(`startup.${key}`, value);
  return value;
}

export function getHotkey(): StoredHotkey {
  return settingsStore.get('hotkey');
}

export function setHotkey(h: StoredHotkey): StoredHotkey {
  settingsStore.set('hotkey', h);
  return h;
}
