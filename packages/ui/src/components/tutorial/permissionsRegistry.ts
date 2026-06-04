import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';
import {
  checkRendererPermission,
  requestRendererPermission,
} from '@dadei/ui/lib/platform/desktopPermissions';
import type { Platform } from './types';

type CheckFn = () => Promise<'granted' | 'denied' | 'unknown'>;
type RequestFn = () => Promise<'granted' | 'denied'>;

export interface PermissionEntry {
  id: string;
  platforms: Platform[];
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

async function checkNotifications(): Promise<'granted' | 'denied' | 'unknown'> {
  if (typeof Notification === 'undefined') return 'unknown';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'unknown';
}

async function requestNotifications(): Promise<'granted' | 'denied'> {
  if (typeof Notification === 'undefined') return 'denied';
  const result = await Notification.requestPermission();
  return result === 'granted' ? 'granted' : 'denied';
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

export const PERMISSIONS: PermissionEntry[] = [
  {
    id: 'microphone',
    platforms: ['desktop-darwin', 'desktop-win32', 'desktop-linux', 'web'],
    label: 'Microphone',
    description: 'Listen to conversations and wake-word commands.',
    check: async () => {
      if (isElectronDesktop() && window.electronAPI?.permissions) {
        const status = await window.electronAPI.permissions.check('microphone');
        return mapDesktopStatus(status);
      }
      return mapDesktopStatus(await checkRendererPermission('microphone'));
    },
    request: async () => {
      if (isElectronDesktop() && window.electronAPI?.permissions) {
        const status = await window.electronAPI.permissions.request('microphone');
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
      if (isElectronDesktop() && window.electronAPI?.permissions) {
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
    description: 'Alerts when Dadei needs your attention.',
    check: checkNotifications,
    request: requestNotifications,
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
    description: 'Control other apps when you ask Dadei to act.',
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

export function permissionsForPlatform(platform: Platform): PermissionEntry[] {
  return PERMISSIONS.filter(perm => perm.platforms.includes(platform));
}

export function detectPlatform(): Platform {
  const raw = window.electronAPI?.platform;
  if (raw === 'darwin') return 'desktop-darwin';
  if (raw === 'win32') return 'desktop-win32';
  if (raw === 'linux') return 'desktop-linux';
  return 'web';
}
