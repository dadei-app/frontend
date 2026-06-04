import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import type { AudioSettings, Modifier } from '@dadei/ui/types/electron';
import { cn } from '@dadei/ui/lib/shared/cn';
import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';
import {
  dispatchAudioSettingsChanged,
  loadAudioSettings,
} from '@dadei/ui/lib/audio/audioSettingsEvents';
import {
  clampMicLevel,
  micLevelMeterLabel,
  useMicLevelPreview,
} from '@dadei/ui/contexts/AudioContext';
import {
  ChipPicker,
  GridTile,
  HotkeyPicker,
  NoiseSuppressionControl,
  PowerToggleButton,
  SegmentedControl,
  SettingsGrid4,
} from '@dadei/ui/components/settings/shared';

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

function MicLevelDisplay({ level }: { level: number }) {
  const clamped = clampMicLevel(level);
  const segments = 24;
  const active = Math.min(segments, Math.max(0, Math.round(clamped * segments)));
  return (
    <div className="flex h-full min-h-0 flex-col justify-end gap-3">
      <div className="flex flex-1 items-end justify-center gap-[3px] px-1 pb-1" aria-hidden>
        {Array.from({ length: segments }).map((_, i) => {
          const on = i < active;
          const t = i / segments;
          const h = 12 + t * 52;
          return (
            <div
              key={i}
              className={cn(
                'w-2 rounded-sm transition-all duration-75',
                on
                  ? t > 0.82
                    ? 'bg-emerald-200 shadow-[0_0_8px_rgba(167,243,208,0.55)]'
                    : t > 0.55
                      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]'
                      : 'bg-emerald-600/90'
                  : 'bg-white/8',
              )}
              style={{ height: h }}
            />
          );
        })}
      </div>
      <div className="overflow-hidden rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2">
        <div className="h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-700 via-emerald-400 to-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.35)] transition-[width] duration-75"
            style={{ width: `${Math.round(clamped * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-center text-[11px] tabular-nums text-zinc-500 font-secondary">
          {micLevelMeterLabel(clamped)}
        </p>
      </div>
    </div>
  );
}

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
  const { hotkey, setHotkey, formatHotkey } = useService();
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
    const merged = { ...(settingsRef.current ?? DEFAULT_AUDIO), ...patch };
    setSettings(merged);

    let next = merged;
    if (window.electronAPI?.audio?.setSettings) {
      try {
        next = await window.electronAPI.audio.setSettings(patch);
        setSettings(next);
      } catch (e) {
        console.error('[Audio] failed to persist settings', e);
      }
    }
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
      opts.push({
        value: d.deviceId,
        label: label.length > 32 ? `${label.slice(0, 30)}…` : label,
      });
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
        <GridTile title="Microphone" col={1} row={1} colSpan={2} rowSpan={2} bodyClassName="min-h-0">
          {deviceError ? (
            <p className="mb-2 shrink-0 text-xs text-amber-300/90 font-secondary">{deviceError}</p>
          ) : null}
          <ChipPicker
            options={micOptions}
            value={selectedMic}
            onChange={id => void applySettings({ inputDeviceId: id || null })}
            columns={2}
            fill
          />
        </GridTile>

        <GridTile title="Sample rate" hint="Bandwidth use." col={3} row={1} colSpan={2} rowSpan={1}>
          <SegmentedControl
            layout="stack"
            options={[
              { value: 16000, label: '16 kHz' },
              { value: 44100, label: '44.1 kHz' },
              { value: 48000, label: '48 kHz' },
            ]}
            value={settings.sampleRate}
            onChange={sampleRate =>
              void applySettings({ sampleRate: sampleRate as AudioSettings['sampleRate'] })
            }
            disabled={!isElectronDesktop()}
          />
        </GridTile>

        <GridTile
          title="Noise suppression"
          col={3}
          row={2}
          colSpan={2}
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
          />
        </GridTile>

        <GridTile
          title="Input level"
          hint="Speak to test your mic."
          col={1}
          row={3}
          colSpan={3}
          rowSpan={2}
        >
          <MicLevelDisplay level={micLevel} />
        </GridTile>

        <GridTile title="Toggle assistant" hint="Hotkey" col={4} row={3} colSpan={1} rowSpan={2}>
          <div className="flex h-full flex-col justify-center">
            <HotkeyPicker
              layout="stack"
              displayLabel={capturing ? 'Press any key…' : formatHotkey()}
              capturing={capturing}
              onStartCapture={() => setCapturing(true)}
              onCancelCapture={() => setCapturing(false)}
              onReset={() => void setHotkey({ key: 'Space', modifiers: [] })}
              showReset={hotkey.key !== 'Space' || hotkey.modifiers.length > 0}
            />
          </div>
        </GridTile>
      </SettingsGrid4>
    </div>
  );
}
