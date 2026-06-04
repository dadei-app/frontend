import { useEffect, useState } from 'react';

import { GridTile, SettingsGrid4 } from '@dadei/ui/components/settings/layout';
import { Toggle } from '@dadei/ui/components/settings/controls';



export function StartupPanel() {

  const [launchAtLogin, setLaunchAtLogin] = useState(false);

  const [minimizeToTray, setMinimizeToTray] = useState(false);

  const isDarwin = window.electronAPI?.platform === 'darwin';



  useEffect(() => {

    if (!window.electronAPI?.startup) return;

    void window.electronAPI.startup.getLaunchAtLogin().then(setLaunchAtLogin);

    void window.electronAPI.startup.getMinimizeToTray().then(setMinimizeToTray);

  }, []);



  return (

    <SettingsGrid4 className="min-h-0 flex-1">

      <GridTile title="Launch at login" col={1} row={1} colSpan={2} rowSpan={2}>

        <Toggle

          portrait

          checked={launchAtLogin}

          onChange={enabled => {

            void window.electronAPI!.startup!.setLaunchAtLogin(enabled).then(setLaunchAtLogin);

          }}

          label="Open Dadei when you sign in"

        />

      </GridTile>



      {!isDarwin ? (

        <GridTile title="Minimize to tray" col={3} row={1} colSpan={2} rowSpan={2}>

          <Toggle

            portrait

            checked={minimizeToTray}

            onChange={enabled => {

              void window.electronAPI!.startup!.setMinimizeToTray(enabled).then(setMinimizeToTray);

            }}

            label="Keep running when the window closes"

          />

        </GridTile>

      ) : null}

    </SettingsGrid4>

  );

}


