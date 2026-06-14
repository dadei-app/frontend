import {
  checkElectronMicrophonePermission,
  checkRendererPermission,
  requestElectronMicrophonePermission,
  requestRendererPermission,
} from '@dadei/ui/lib/platform/runtime/desktopPermissions';
import type { TutorialPlatform } from '@dadei/ui/types/tutorial.types';

type CheckFn = () => Promise<'granted' | 'denied' | 'unknown'>;
type RequestFn = () => Promise<'granted' | 'denied'>;

export interface PermissionEntry {
  id: string;
  platforms: TutorialPlatform[];
  label: string;
  description: string;
  check: CheckFn;
  request: RequestFn;
  settingsDeepLink?: string;
}

function mapDesktopStatus(
  status: 'granted' | 'denied' | 'not-determined' | 'unsupported',
): 'granted' | 'denied' | 'unknown' {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'unknown';
}

function checkNotifications(isElectron: boolean): CheckFn {
  return async () => {
    if (typeof Notification === 'undefined') {
      return isElectron ? 'granted' : 'unknown';
    }
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return 'unknown';
  };
}

function requestNotifications(isElectron: boolean): RequestFn {
  return async () => {
    if (typeof Notification === 'undefined') {
      return isElectron ? 'granted' : 'denied';
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') return 'granted';
    // Desktop uses in-app toasts/banners; no separate OS notification gate.
    if (isElectron) return 'granted';
    return 'denied';
  };
}

async function checkMacTutorialPermission(kind: string): Promise<'granted' | 'denied' | 'unknown'> {
  const api = window.electronAPI?.permissions;
  if (!api?.checkTutorial) return 'unknown';
  const status = await api.checkTutorial(kind);
  return mapDesktopStatus(status);
}

async function openMacTutorialSettings(kind: string): Promise<'granted' | 'denied'> {
  const api = window.electronAPI?.permissions;
  if (!api?.openTutorialSettings) return 'denied';
  await api.openTutorialSettings(kind);
  const after = await checkMacTutorialPermission(kind);
  return after === 'granted' ? 'granted' : 'denied';
}

export function buildPermissionEntries(isElectron: boolean): PermissionEntry[] {
  return [
    {
      id: 'microphone',
      platforms: ['desktop-darwin', 'desktop-win32', 'desktop-linux', 'web'],
      label: 'Microphone',
      description: 'Listen to conversations and wake-word commands.',
      check: async () => {
        if (isElectron) {
          return mapDesktopStatus(await checkElectronMicrophonePermission());
        }
        return mapDesktopStatus(await checkRendererPermission('microphone'));
      },
      request: async () => {
        if (isElectron) {
          const status = await requestElectronMicrophonePermission();
          return status === 'granted' ? 'granted' : 'denied';
        }
        const status = await requestRendererPermission('microphone');
        return status === 'granted' ? 'granted' : 'denied';
      },
    },
    {
      id: 'location',
      platforms: ['desktop-darwin', 'desktop-win32', 'desktop-linux', 'web'],
      label: 'Location',
      description: 'Context for weather and local recommendations.',
      check: async () => {
        if (isElectron && window.electronAPI?.permissions) {
          const status = await window.electronAPI.permissions.check('location');
          if (status !== 'not-determined') return mapDesktopStatus(status);
        }
        return mapDesktopStatus(await checkRendererPermission('location'));
      },
      request: async () => {
        const meta = await window.electronAPI?.permissions?.getMeta?.();
        const status = await requestRendererPermission('location', {
          geolocationConfigured: meta?.geolocationConfigured,
        });
        return status === 'granted' ? 'granted' : 'denied';
      },
    },
    {
      id: 'notifications',
      platforms: ['desktop-darwin', 'desktop-win32', 'desktop-linux', 'web'],
      label: 'Notifications',
      description: 'Alerts when dadei needs your attention.',
      check: checkNotifications(isElectron),
      request: requestNotifications(isElectron),
    },
    {
      id: 'accessibility',
      platforms: ['desktop-darwin'],
      label: 'Accessibility',
      description: 'Required for some desktop automations on macOS.',
      check: () => checkMacTutorialPermission('accessibility'),
      request: () => openMacTutorialSettings('accessibility'),
      settingsDeepLink:
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    },
    {
      id: 'screen_recording',
      platforms: ['desktop-darwin'],
      label: 'Screen recording',
      description: 'Screen context when needed on macOS.',
      check: () => checkMacTutorialPermission('screen_recording'),
      request: () => openMacTutorialSettings('screen_recording'),
      settingsDeepLink:
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    },
    {
      id: 'automation',
      platforms: ['desktop-darwin'],
      label: 'Automation',
      description: 'Control other apps when you ask dadei to act.',
      check: () => checkMacTutorialPermission('automation'),
      request: () => openMacTutorialSettings('automation'),
      settingsDeepLink:
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
    },
    {
      id: 'input_monitoring',
      platforms: ['desktop-darwin'],
      label: 'Input monitoring',
      description: 'Global hotkey and input awareness on macOS.',
      check: () => checkMacTutorialPermission('input_monitoring'),
      request: () => openMacTutorialSettings('input_monitoring'),
      settingsDeepLink:
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
    },
  ];
}

/** Permission ids needed for this client surface (derived from live client capabilities). */
export function permissionIdsForClient(
  platform: TutorialPlatform,
  isElectron: boolean,
): string[] {
  const ids: string[] = ['microphone', 'location', 'notifications'];
  if (!isElectron) return ids;
  if (platform === 'desktop-darwin') {
    ids.push('accessibility', 'screen_recording', 'automation', 'input_monitoring');
  }
  return ids;
}

export function permissionsForPlatform(
  platform: TutorialPlatform,
  isElectron: boolean,
): PermissionEntry[] {
  const allowed = new Set(permissionIdsForClient(platform, isElectron));
  return buildPermissionEntries(isElectron).filter(
    perm => perm.platforms.includes(platform) && allowed.has(perm.id),
  );
}

export const REQUIRED_PERMISSION_IDS = new Set(['microphone']);

export function isRequiredPermission(entry: PermissionEntry): boolean {
  return REQUIRED_PERMISSION_IDS.has(entry.id);
}

/** True when every permission required to run the assistant is granted. */
export async function areRequiredPermissionsGranted(
  platform: TutorialPlatform,
  isElectron: boolean,
): Promise<boolean> {
  const entries = permissionsForPlatform(platform, isElectron).filter(isRequiredPermission);
  if (entries.length === 0) return true;
  const results = await Promise.all(entries.map(entry => entry.check()));
  return results.every(result => result === 'granted');
}

/** True when every client capability permission for this platform is granted. */
export async function areAllClientPermissionsGranted(
  platform: TutorialPlatform,
  isElectron: boolean,
): Promise<boolean> {
  const entries = permissionsForPlatform(platform, isElectron);
  if (entries.length === 0) return true;
  const results = await Promise.all(entries.map(entry => entry.check()));
  return results.every(result => result === 'granted');
}

/** True when at least one client capability permission is not granted. */
export async function hasMissingClientPermissions(
  platform: TutorialPlatform,
  isElectron: boolean,
): Promise<boolean> {
  return !(await areAllClientPermissionsGranted(platform, isElectron));
}

type SystemPlatform = 'darwin' | 'win32' | 'linux' | 'web';

/** Map SystemContext platform + runtime to tutorial permission scope. */
export function toTutorialPlatform(platform: SystemPlatform, isElectron: boolean): TutorialPlatform {
  if (!isElectron) return 'web';
  if (platform === 'darwin') return 'desktop-darwin';
  if (platform === 'win32') return 'desktop-win32';
  if (platform === 'linux') return 'desktop-linux';
  return 'web';
}
