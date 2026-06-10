import { shell, systemPreferences } from 'electron';

export type TutorialMacPermissionKind =
  | 'accessibility'
  | 'screen_recording'
  | 'automation'
  | 'input_monitoring';

export type TutorialMacPermissionStatus = 'granted' | 'denied' | 'not-determined' | 'unsupported';

const SETTINGS_URLS: Record<TutorialMacPermissionKind, string> = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screen_recording:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
  input_monitoring:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
};

export function checkTutorialMacPermission(
  kind: TutorialMacPermissionKind,
): TutorialMacPermissionStatus {
  if (process.platform !== 'darwin') return 'unsupported';
  if (kind === 'accessibility') {
    return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'not-determined';
  }
  if (kind === 'screen_recording') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    if (status === 'granted') return 'granted';
    if (status === 'denied' || status === 'restricted') return 'denied';
    return 'not-determined';
  }
  return 'not-determined';
}

export async function openTutorialMacSettings(kind: TutorialMacPermissionKind): Promise<void> {
  const url = SETTINGS_URLS[kind];
  if (url) {
    await shell.openExternal(url);
  }
}
