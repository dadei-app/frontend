import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import type { AudioSettings, Modifier } from '@dadei/ui/types/electron';
import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';
import {
  dispatchAudioSettingsChanged,
  loadAudioSettings,
  persistAudioSettings,
} from '@dadei/ui/lib/audio/audioSettingsEvents';
import { useMicLevelPreview } from '@dadei/ui/contexts/AudioContext';
import { GridTile, SettingsGrid4 } from '@dadei/ui/components/settings/layout';
import {
  NoiseSuppressionControl,
  PowerToggleButton,
} from '@dadei/ui/components/settings/controls';
import { AssistantHotkeyControl } from './AssistantHotkeyControl';
import { MicDeviceList } from './MicDeviceList';
import { MicLevelMeter } from './MicLevelMeter';

const MODIFIER_ONLY = new Set([
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

const DEFAULT_AUDIO: AudioSettings = {
  inputDeviceId: null,
  sampleRate: 16000,
  noiseSuppression: true,
  noiseSuppressionLevel: 50,
};

async function enumerateMicInputs(): Promise<MediaDeviceInfo[]> {
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    probe.getTracks().forEach(t => t.stop());
  } catch {
    // Permission denied — enumerateDevices may still return ids without labels.
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(d => d.kind === 'audioinput' && d.deviceId.length > 0);
}

export function AudioPanel() {
  const { hotkey, setHotkey, formatHotkey } = useSystem();
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const settingsRef = useRef<AudioSettings | null>(null);
  const micLevel = useMicLevelPreview(Boolean(settings));

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refreshDevices = useCallback(async () => {
    try {
      const inputs = await enumerateMicInputs();
      setDevices(inputs);
      setDeviceError(inputs.length === 0 ? 'No microphone devices found.' : null);
    } catch {
      setDeviceError('Could not list microphones.');
    }
  }, []);

  useEffect(() => {
    void loadAudioSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_AUDIO));
    void refreshDevices();

    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange);
  }, [refreshDevices]);

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (MODIFIER_ONLY.has(e.code)) return;
      const modifiers: Modifier[] = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');
      if (e.metaKey) modifiers.push('Meta');
      void setHotkey({ key: e.code, modifiers });
      setCapturing(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturing, setHotkey]);

  const applySettings = useCallback(async (patch: Partial<AudioSettings>) => {
    const next = await persistAudioSettings(patch);
    setSettings(next);
    settingsRef.current = next;
    dispatchAudioSettingsChanged(next);
  }, []);

  const micOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: Array<{ value: string; label: string }> = [{ value: '', label: 'System default' }];
    for (const d of devices) {
      if (seen.has(d.deviceId)) continue;
      seen.add(d.deviceId);
      const label = d.label?.trim() || `Microphone ${opts.length}`;
      opts.push({ value: d.deviceId, label });
    }
    return opts;
  }, [devices]);

  const selectedMic =
    settings?.inputDeviceId && micOptions.some(o => o.value === settings.inputDeviceId)
      ? settings.inputDeviceId
      : '';

  if (!settings) {
    return <p className="text-base text-zinc-500">Loading audio settings…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!isElectronDesktop() ? (
        <p className="shrink-0 text-xs text-zinc-500 font-secondary">
          Device preferences persist in the desktop app. Mic changes apply to this session.
        </p>
      ) : null}

      <SettingsGrid4 className="flex-1">
        <GridTile
          title="Microphone"
          col={1}
          row={1}
          colSpan={3}
          rowSpan={2}
          bodyClassName="min-h-0"
        >
          {deviceError ? (
            <p className="mb-2 shrink-0 text-xs text-amber-300/90 font-secondary">{deviceError}</p>
          ) : null}
          <MicDeviceList
            options={micOptions}
            value={selectedMic}
            onChange={id => void applySettings({ inputDeviceId: id || null })}
          />
        </GridTile>

        <GridTile
          title="Noise suppression"
          col={4}
          row={1}
          colSpan={1}
          rowSpan={1}
          headerAction={
            <PowerToggleButton
              active={settings.noiseSuppression}
              label={
                settings.noiseSuppression
                  ? 'Turn off noise suppression'
                  : 'Turn on noise suppression'
              }
              onClick={() => void applySettings({ noiseSuppression: !settings.noiseSuppression })}
            />
          }
        >
          <NoiseSuppressionControl
            enabled={settings.noiseSuppression}
            level={settings.noiseSuppressionLevel}
            onLevelChange={noiseSuppressionLevel => void applySettings({ noiseSuppressionLevel })}
            compact
          />
        </GridTile>

        <GridTile title="Toggle assistant" col={4} row={2} colSpan={1} rowSpan={1}>
          <AssistantHotkeyControl
            compact
            displayLabel={capturing ? 'Press any key…' : formatHotkey()}
            capturing={capturing}
            onStartCapture={() => setCapturing(true)}
            onCancelCapture={() => setCapturing(false)}
            onReset={() => void setHotkey({ key: 'Space', modifiers: [] })}
            showReset={hotkey.key !== 'Space' || hotkey.modifiers.length > 0}
          />
        </GridTile>

        <GridTile
          title="Input level"
          hint="Speak normally — aim for Medium"
          col={1}
          row={3}
          colSpan={4}
          rowSpan={2}
          bodyClassName="min-h-0"
        >
          <MicLevelMeter level={micLevel} />
        </GridTile>
      </SettingsGrid4>
    </div>
  );
}
