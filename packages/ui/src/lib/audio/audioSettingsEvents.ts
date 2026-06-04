import type { AudioSettings } from '@dadei/ui/types/electron';

export const AUDIO_SETTINGS_CHANGED = 'dadei:audio-settings-changed';

export function dispatchAudioSettingsChanged(settings: AudioSettings): void {
  window.dispatchEvent(
    new CustomEvent<AudioSettings>(AUDIO_SETTINGS_CHANGED, { detail: settings }),
  );
}

export async function loadAudioSettings(): Promise<AudioSettings> {
  if (window.electronAPI?.audio?.getSettings) {
    return window.electronAPI.audio.getSettings();
  }
  return {
    inputDeviceId: null,
    sampleRate: 16000,
    noiseSuppression: true,
    noiseSuppressionLevel: 50,
  };
}
