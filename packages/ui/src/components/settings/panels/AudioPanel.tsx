import { useContext, useEffect, useState } from 'react';
import { AudioContext } from '@dadei/ui/contexts/AudioContext';
import { useHotkey } from '@dadei/ui/contexts/HotkeyContext';
import {
  COMMAND_MIC_LEVEL_GAIN,
  COMMAND_SPEECH_RMS,
} from '@dadei/ui/lib/voice/session/voiceConstants';
import type { AudioSettings, Modifier } from '@dadei/ui/types/electron';
import { cn } from '@dadei/ui/lib/shared/cn';
import { SettingsField } from '@dadei/ui/components/settings/panels/SettingsField';
import { SegmentedControl, Slider, Toggle } from '@dadei/ui/components/settings/panels/SettingsControls';

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

function MicLevelMeter({ level, gateThreshold }: { level: number; gateThreshold: number }) {
  const bars = 12;
  const activeBars = Math.min(bars, Math.round(level * bars * COMMAND_MIC_LEVEL_GAIN * 4));
  void gateThreshold;
  return (
    <div className="flex h-9 items-end gap-0.5" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const active = i < activeBars;
        const intensity = i / bars;
        const heightPx = 6 + intensity * 24;
        return (
          <div
            key={i}
            className={cn(
              'w-1 rounded-sm transition-all duration-75',
              active ? (intensity > 0.7 ? 'bg-emerald-300' : 'bg-emerald-500') : 'bg-white/10',
            )}
            style={{ height: heightPx }}
          />
        );
      })}
    </div>
  );
}

export function AudioPanel() {
  const audioCtx = useContext(AudioContext);
  const micLevel = audioCtx?.micLevel ?? 0;
  const { hotkey, setHotkey, formatHotkey } = useHotkey();
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [capturing, setCapturing] = useState(false);
  const hasElectronAudio = Boolean(window.electronAPI?.audio);

  useEffect(() => {
    if (window.electronAPI?.audio?.getSettings) {
      void window.electronAPI.audio.getSettings().then(setSettings).catch(() => setSettings(DEFAULT_AUDIO));
    } else {
      setSettings(DEFAULT_AUDIO);
    }
    void navigator.mediaDevices.enumerateDevices().then(all => {
      setDevices(all.filter(d => d.kind === 'audioinput'));
    });
  }, []);

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

  const update = async (patch: Partial<AudioSettings>) => {
    if (window.electronAPI?.audio?.setSettings) {
      const next = await window.electronAPI.audio.setSettings(patch);
      setSettings(next);
      return;
    }
    setSettings(prev => ({ ...(prev ?? DEFAULT_AUDIO), ...patch }));
  };

  if (!settings) {
    return <p className="text-sm text-zinc-500">Loading audio settings…</p>;
  }

  return (
    <div className="conic-border glass-panel max-w-2xl space-y-6 rounded-lg p-5">
      {!hasElectronAudio ? (
        <p className="text-xs text-zinc-500 font-secondary">
          Device and sample-rate preferences are saved in the desktop app. Hotkey rebind works in
          this session on web.
        </p>
      ) : null}

      <SettingsField label="Microphone input">
        <div className="flex items-center gap-3">
          <select
            value={settings.inputDeviceId ?? ''}
            onChange={e => void update({ inputDeviceId: e.target.value || null })}
            disabled={!hasElectronAudio}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-900/60 px-3 py-2 text-zinc-100 emerald-glow disabled:opacity-60"
          >
            <option value="">System default</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Device ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
          <MicLevelMeter level={micLevel} gateThreshold={COMMAND_SPEECH_RMS} />
        </div>
      </SettingsField>

      <SettingsField label="Sample rate" hint="Higher rates use more bandwidth.">
        <SegmentedControl
          options={[
            { value: 16000, label: '16 kHz' },
            { value: 44100, label: '44.1 kHz' },
            { value: 48000, label: '48 kHz' },
          ]}
          value={settings.sampleRate}
          onChange={sampleRate => void update({ sampleRate: sampleRate as AudioSettings['sampleRate'] })}
        />
      </SettingsField>

      <SettingsField label="Noise suppression">
        <div className="space-y-3">
          <Toggle
            checked={settings.noiseSuppression}
            onChange={noiseSuppression => void update({ noiseSuppression })}
            label="Reduce background hiss and steady hum"
          />
          {settings.noiseSuppression ? (
            <div className="pl-2">
              <Slider
                min={0}
                max={100}
                step={5}
                value={settings.noiseSuppressionLevel}
                onChange={noiseSuppressionLevel => void update({ noiseSuppressionLevel })}
              />
            </div>
          ) : null}
        </div>
      </SettingsField>

      <SettingsField label="Toggle assistant hotkey">
        <div className="flex flex-wrap items-center gap-3">
          <kbd
            className={cn(
              'rounded-md border bg-zinc-900/80 px-4 py-2 font-mono text-base shadow-inner shadow-black/40 transition',
              capturing
                ? 'animate-pulse border-emerald-500/60 text-emerald-200'
                : 'border-white/10 text-zinc-300',
            )}
          >
            {capturing ? 'Press any key…' : formatHotkey()}
          </kbd>
          <button
            type="button"
            onClick={() => setCapturing(c => !c)}
            className="rounded-md border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {capturing ? 'Cancel' : 'Rebind'}
          </button>
          {(hotkey.key !== 'Space' || hotkey.modifiers.length > 0) && (
            <button
              type="button"
              onClick={() => void setHotkey({ key: 'Space', modifiers: [] })}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Reset to Space
            </button>
          )}
        </div>
      </SettingsField>
    </div>
  );
}
