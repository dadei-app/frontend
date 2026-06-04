type ClientActionMessage = {
  action?: unknown;
  params?: unknown;
};

type Params = Record<string, unknown>;

function asParams(value: unknown): Params {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Params;
}

function numberParam(params: Params, key: string): number | undefined {
  const raw = params[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringParam(params: Params, key: string): string | undefined {
  const raw = params[key];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export async function dispatchClientAction(message: ClientActionMessage): Promise<void> {
  if (!window.electronAPI) {
    console.warn('[client_action] Received on non-electron client, ignoring', message);
    return;
  }

  const action = typeof message.action === 'string' ? message.action : '';
  const params = asParams(message.params);

  switch (action) {
    case 'set_volume':
      await window.electronAPI.setVolume(numberParam(params, 'level') ?? 50);
      return;
    case 'volume_up':
      await window.electronAPI.volumeUp();
      return;
    case 'volume_down':
      await window.electronAPI.volumeDown();
      return;
    case 'volume_mute':
      await window.electronAPI.volumeMute();
      return;
    case 'media_play_pause':
      await window.electronAPI.mediaPlayPause();
      return;
    case 'media_next':
      await window.electronAPI.mediaNext();
      return;
    case 'media_previous':
      await window.electronAPI.mediaPrevious();
      return;
    case 'media_stop':
      await window.electronAPI.mediaStop();
      return;
    case 'toggle_dark_mode':
      await window.electronAPI.toggleDarkMode();
      return;
    case 'lock_device':
      await window.electronAPI.lockDevice();
      return;
    case 'sleep_device':
      await window.electronAPI.sleepDevice();
      return;
    case 'open_app': {
      const name = stringParam(params, 'name');
      if (!name) {
        console.warn('[client_action] open_app missing name param', message);
        return;
      }
      await window.electronAPI.openApp(name);
      return;
    }
    case 'close_focused_app':
      await window.electronAPI.closeFocusedApp();
      return;
    case 'minimize_focused_window':
      await window.electronAPI.minimizeFocusedWindow();
      return;
    case 'toggle_fullscreen':
      await window.electronAPI.toggleFullscreen();
      return;
    case 'dismiss_notifications':
      await window.electronAPI.dismissNotifications();
      return;
    case 'toggle_dnd':
      await window.electronAPI.toggleDoNotDisturb();
      return;
    default:
      console.warn('[client_action] Unknown action, ignoring', message);
  }
}
