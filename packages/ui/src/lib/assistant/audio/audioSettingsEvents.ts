import type { AudioSettings } from '@dadei/ui/types/electron';

export const AUDIO_SETTINGS_CHANGED = 'dadei:audio-settings-changed';

const WEB_STORAGE_KEY = 'dadei:audio-settings';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  inputDeviceId: null,
  sampleRate: 16000,
  noiseSuppression: true,
  noiseSuppressionLevel: 50,
};

export function dispatchAudioSettingsChanged(settings: AudioSettings): void {
  window.dispatchEvent(
    new CustomEvent<AudioSettings>(AUDIO_SETTINGS_CHANGED, { detail: settings }),
  );
}

function loadWebAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      ...DEFAULT_AUDIO_SETTINGS,
      ...parsed,
      sampleRate:
        parsed.sampleRate === 44100 || parsed.sampleRate === 48000
          ? parsed.sampleRate
          : 16000,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveWebAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode / quota — ignore.
  }
}

export async function loadAudioSettings(): Promise<AudioSettings> {
  if (window.electronAPI?.audio?.getSettings) {
    return window.electronAPI.audio.getSettings();
  }
  return loadWebAudioSettings();
}

export async function persistAudioSettings(
  patch: Partial<AudioSettings>,
): Promise<AudioSettings> {
  const current = await loadAudioSettings();
  const merged = { ...current, ...patch };

  if (window.electronAPI?.audio?.setSettings) {
    try {
      return await window.electronAPI.audio.setSettings(patch);
    } catch (e) {
      console.error('[Audio] failed to persist settings', e);
      return merged;
    }
  }

  saveWebAudioSettings(merged);
  return merged;
}
