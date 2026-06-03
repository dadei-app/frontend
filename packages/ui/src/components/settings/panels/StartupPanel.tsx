import { useEffect, useState } from 'react';
import { SettingsField } from '@dadei/ui/components/settings/panels/SettingsField';
import { Toggle } from '@dadei/ui/components/settings/panels/SettingsControls';

export function StartupPanel() {
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(false);
  const isDarwin = window.electronAPI?.platform === 'darwin';
  const hasStartup = Boolean(window.electronAPI?.startup);

  useEffect(() => {
    if (!window.electronAPI?.startup) return;
    void window.electronAPI.startup.getLaunchAtLogin().then(setLaunchAtLogin);
    void window.electronAPI.startup.getMinimizeToTray().then(setMinimizeToTray);
  }, []);

  if (!hasStartup) {
    return (
      <div className="conic-border glass-panel max-w-2xl rounded-lg p-5">
        <p className="text-sm text-zinc-500 font-secondary">
          Startup preferences are available in the desktop app.
        </p>
      </div>
    );
  }

  return (
    <div className="conic-border glass-panel max-w-2xl space-y-6 rounded-lg p-5">
      <SettingsField label="Launch at login">
        <Toggle
          checked={launchAtLogin}
          onChange={enabled => {
            void window.electronAPI!.startup!.setLaunchAtLogin(enabled).then(setLaunchAtLogin);
          }}
          label="Open Dadei when you sign in to your computer"
        />
      </SettingsField>

      {!isDarwin ? (
        <SettingsField label="Minimize to tray">
          <Toggle
            checked={minimizeToTray}
            onChange={enabled => {
              void window.electronAPI!.startup!.setMinimizeToTray(enabled).then(setMinimizeToTray);
            }}
            label="Keep running in the background when the window is closed"
          />
        </SettingsField>
      ) : null}
    </div>
  );
}
