import { useEffect, useState } from 'react';
import { MapPin, Mic2, Monitor, type LucideIcon } from 'lucide-react';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { GridTile, SettingsGrid4 } from '@dadei/ui/components/settings/layout';
import { Toggle } from '@dadei/ui/components/settings/controls';
import type {
  DesktopPermissionKind,
  DesktopPermissionStatus,
} from '@dadei/ui/types/electron';
import { cn } from '@dadei/ui/lib/shared/cn';

const PERMISSION_META: Record<
  DesktopPermissionKind,
  { icon: LucideIcon; title: string; short: string }
> = {
  location: { icon: MapPin, title: 'Location', short: 'Geo' },
  microphone: { icon: Mic2, title: 'Microphone', short: 'Mic' },
  screen: { icon: Monitor, title: 'Screen', short: 'Screen' },
};

function statusLabel(
  status: DesktopPermissionStatus,
  kind: DesktopPermissionKind,
  geolocationConfigured: boolean,
): string {
  if (kind === 'location' && !geolocationConfigured) return 'Needs API key';
  switch (status) {
    case 'granted':
      return 'Allowed';
    case 'denied':
      return 'Denied';
    case 'unsupported':
      return 'Unavailable';
    default:
      return 'Tap to allow';
  }
}

function PermissionSquare({
  kind,
  status,
  busy,
  geolocationConfigured,
  onRequest,
}: {
  kind: DesktopPermissionKind;
  status: DesktopPermissionStatus;
  busy: boolean;
  geolocationConfigured: boolean;
  onRequest: () => void;
}) {
  const { icon: Icon, title, short } = PERMISSION_META[kind];
  const granted = status === 'granted';
  const denied = status === 'denied';
  const needsApiKey = kind === 'location' && !geolocationConfigured;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onRequest}
      className={cn(
        'flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 rounded-lg border border-white/8 bg-zinc-900/35 p-2 text-center transition emerald-glow',
        'hover:border-white/15 hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-50',
        granted && 'border-emerald-500/35 bg-emerald-500/8',
        denied && 'border-rose-500/30 bg-rose-500/5',
        needsApiKey && 'border-amber-500/35 bg-amber-500/5',
      )}
      aria-label={`${title}: ${statusLabel(status, kind, geolocationConfigured)}`}
    >
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80',
          granted && 'border-emerald-500/40 text-emerald-300',
          denied && 'border-rose-500/35 text-rose-300',
          !granted && !denied && 'text-zinc-400',
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="text-xs font-medium text-zinc-200">{short}</span>
      <span
        className={cn(
          'text-[10px] leading-tight text-zinc-500',
          granted && 'text-emerald-400/90',
          denied && 'text-rose-400/90',
        )}
      >
        {busy ? 'Checking…' : statusLabel(status, kind, geolocationConfigured)}
      </span>
    </button>
  );
}

function StartupSquare({
  title,
  label,
  checked,
  onChange,
}: {
  title: string;
  label: string;
  checked: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-between gap-2">
      <p className="text-xs font-medium text-zinc-300">{title}</p>
      <Toggle portrait checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function StartupPanel() {
  const { showToast } = useNotifications();
  const {
    startup,
    startupLoaded,
    supportsMinimizeToTray,
    permissions,
    permissionsLoaded,
    geolocationConfigured,
    refreshPermissions,
    requestAppPermission,
    setLaunchAtLogin,
    setStartMinimized,
    setMinimizeToTray,
  } = useSystem();
  const [busyKind, setBusyKind] = useState<DesktopPermissionKind | null>(null);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  const requestPermission = async (kind: DesktopPermissionKind) => {
    setBusyKind(kind);
    try {
      const status = await requestAppPermission(kind);
      const meta = PERMISSION_META[kind];
      if (kind === 'location' && !geolocationConfigured) {
        showToast(
          'Set GOOGLE_API_KEY in frontend/.env (Geolocation API + billing), then restart the desktop app.',
          'error',
        );
        return;
      }
      if (status === 'granted') {
        showToast(`${meta.title} access allowed`, 'success');
      } else if (status === 'denied') {
        showToast(`${meta.title} access denied — check system settings`, 'error');
      } else if (status === 'unsupported') {
        showToast(`${meta.title} is not available here`, 'error');
      } else {
        showToast(`${meta.title} permission not confirmed yet`, 'info');
      }
      await refreshPermissions();
    } finally {
      setBusyKind(null);
    }
  };

  if (!startupLoaded || !permissionsLoaded) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-zinc-500">
        Loading startup settings…
      </div>
    );
  }

  const hideCloseHint = supportsMinimizeToTray
    ? 'Hide window; restore from tray'
    : 'Hide window; app stays in Dock';

  return (
    <SettingsGrid4 className="min-h-0 flex-1">
      <GridTile title="At login" col={1} row={1} bodyClassName="min-h-0">
        <StartupSquare
          title="Launch"
          label="Open on sign-in"
          checked={startup.launchAtLogin}
          onChange={enabled => {
            void setLaunchAtLogin(enabled);
          }}
        />
      </GridTile>

      <GridTile title="Startup" col={2} row={1} bodyClassName="min-h-0">
        <StartupSquare
          title="Window"
          label="Start minimized"
          checked={startup.startMinimized}
          onChange={enabled => {
            void setStartMinimized(enabled);
          }}
        />
      </GridTile>

      <GridTile title="On close" hint={hideCloseHint} col={3} row={1} bodyClassName="min-h-0">
        <StartupSquare
          title="Close"
          label="Hide, don't quit"
          checked={startup.minimizeToTray}
          onChange={enabled => {
            void setMinimizeToTray(enabled);
          }}
        />
      </GridTile>

      <GridTile col={4} row={1} className="p-2" bodyClassName="min-h-0 flex-1">
        <PermissionSquare
          kind="location"
          status={permissions.location}
          busy={busyKind === 'location'}
          geolocationConfigured={geolocationConfigured}
          onRequest={() => void requestPermission('location')}
        />
      </GridTile>

      <GridTile col={1} row={2} className="p-2" bodyClassName="min-h-0 flex-1">
        <PermissionSquare
          kind="microphone"
          status={permissions.microphone}
          busy={busyKind === 'microphone'}
          geolocationConfigured={geolocationConfigured}
          onRequest={() => void requestPermission('microphone')}
        />
      </GridTile>

      <GridTile col={2} row={2} className="p-2" bodyClassName="min-h-0 flex-1">
        <PermissionSquare
          kind="screen"
          status={permissions.screen}
          busy={busyKind === 'screen'}
          geolocationConfigured={geolocationConfigured}
          onRequest={() => void requestPermission('screen')}
        />
      </GridTile>
    </SettingsGrid4>
  );
}
