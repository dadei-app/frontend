import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import type { Modifier } from '@dadei/ui/types/electron';
import { useMicLevelPreview } from '@dadei/ui/contexts/AudioContext';
import { useTutorialSettingsTourActive } from '@dadei/ui/contexts/TutorialContext';
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

export function AudioPanel() {
  const {
    isElectron,
    audioSettings: settings,
    updateAudioSettings,
    setHotkey,
    formatHotkey,
    micDevices: devices,
    refreshMicDevices,
  } = useSystem();
  const tutorialSettingsStep = useTutorialSettingsTourActive();
  const [capturing, setCapturing] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const micLevel = useMicLevelPreview(!tutorialSettingsStep);

  useEffect(() => {
    void refreshMicDevices();
  }, [refreshMicDevices]);

  useEffect(() => {
    if (devices.length === 0) return;
    setDeviceError(null);
  }, [devices.length]);

  useEffect(() => {
    if (devices.length > 0) return;
    const t = window.setTimeout(() => {
      setDeviceError('No microphone devices found.');
    }, 800);
    return () => window.clearTimeout(t);
  }, [devices.length]);

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setCapturing(false);
        return;
      }
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

  const applySettings = useCallback(
    (patch: Parameters<typeof updateAudioSettings>[0]) => {
      void updateAudioSettings(patch);
    },
    [updateAudioSettings],
  );

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
    settings.inputDeviceId && micOptions.some(o => o.value === settings.inputDeviceId)
      ? settings.inputDeviceId
      : '';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 lg:gap-3">
      {!isElectron ? (
        <p className="settings-hide-sm shrink-0 text-xs text-zinc-500 font-secondary">
          Device preferences persist in the desktop app. Mic changes apply to this session.
        </p>
      ) : null}

      <SettingsGrid4 layout="audio" className="min-h-0 flex-1 lg:h-full">
        <GridTile
          tile="mic"
          title="Microphone"
          scrollable
          bodyClassName="flex min-h-0 flex-col"
        >
          {deviceError ? (
            <p className="mb-2 shrink-0 text-xs text-amber-300/90 font-secondary">{deviceError}</p>
          ) : null}
          <MicDeviceList
            options={micOptions}
            value={selectedMic}
            onChange={id => applySettings({ inputDeviceId: id || null })}
          />
        </GridTile>

        <GridTile
          tile="noise"
          title="Noise suppression"
          headerAction={
            <PowerToggleButton
              active={settings.noiseSuppression}
              label={
                settings.noiseSuppression
                  ? 'Turn off noise suppression'
                  : 'Turn on noise suppression'
              }
              onClick={() => applySettings({ noiseSuppression: !settings.noiseSuppression })}
            />
          }
        >
          <NoiseSuppressionControl
            enabled={settings.noiseSuppression}
            level={settings.noiseSuppressionLevel}
            onLevelChange={noiseSuppressionLevel => applySettings({ noiseSuppressionLevel })}
            compact
          />
        </GridTile>

        <GridTile tile="hotkey" title="Toggle assistant">
          <AssistantHotkeyControl
            compact
            displayLabel={capturing ? 'Press any key…' : formatHotkey()}
            capturing={capturing}
            onPressDisplay={() => setCapturing(prev => !prev)}
          />
        </GridTile>

        <GridTile
          tile="meter"
          title="Input level"
          hint="Speak normally — aim for Medium"
          bodyClassName="min-h-0"
        >
          <MicLevelMeter level={micLevel} />
        </GridTile>
      </SettingsGrid4>
    </div>
  );
}
