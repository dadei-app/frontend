import type {
  DesktopPermissionKind,
  DesktopPermissionStatus,
} from '@dadei/ui/types/electron';

function mergePermissionStatus(
  main: DesktopPermissionStatus,
  renderer: DesktopPermissionStatus,
): DesktopPermissionStatus {
  if (main === 'granted' || renderer === 'granted') return 'granted';
  if (main === 'denied' || renderer === 'denied') return 'denied';
  if (main === 'unsupported' && renderer === 'unsupported') return 'unsupported';
  return 'not-determined';
}

/** macOS media access (main) + Chromium mic prompt (renderer) on Windows/Linux. */
export async function checkElectronMicrophonePermission(): Promise<DesktopPermissionStatus> {
  let main: DesktopPermissionStatus = 'not-determined';
  if (window.electronAPI?.permissions) {
    main = await window.electronAPI.permissions.check('microphone');
  }
  if (main === 'granted' || main === 'denied') return main;
  return checkRendererPermission('microphone');
}

export async function requestElectronMicrophonePermission(): Promise<DesktopPermissionStatus> {
  let main: DesktopPermissionStatus = 'not-determined';
  if (window.electronAPI?.permissions) {
    main = await window.electronAPI.permissions.request('microphone');
  }
  const renderer = await requestRendererPermission('microphone');
  return mergePermissionStatus(main, renderer);
}

/** Geolocation/mic must run in the renderer (user gesture). Main process handles screen + macOS media. */
export async function checkRendererPermission(
  kind: Extract<DesktopPermissionKind, 'location' | 'microphone'>,
): Promise<DesktopPermissionStatus> {
  if (typeof navigator === 'undefined') return 'unsupported';

  if (kind === 'location') {
    if (!navigator.geolocation) return 'unsupported';
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted') return 'granted';
      if (status.state === 'denied') return 'denied';
      return 'not-determined';
    } catch {
      return 'not-determined';
    }
  }

  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') return 'denied';
    return 'not-determined';
  } catch {
    return 'not-determined';
  }
}

export async function requestRendererPermission(
  kind: Extract<DesktopPermissionKind, 'location' | 'microphone'>,
  options: { geolocationConfigured?: boolean } = {},
): Promise<DesktopPermissionStatus> {
  if (typeof navigator === 'undefined') return 'unsupported';

  if (kind === 'location') {
    if (!navigator.geolocation) return 'unsupported';
    if (options.geolocationConfigured === false) return 'unsupported';

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        err => {
          if (err?.code === 1) resolve('denied');
          else resolve('not-determined');
        },
        { enableHighAccuracy: false, timeout: 4_000, maximumAge: 0 },
      );
    });
  }

  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    return 'granted';
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    return 'not-determined';
  }
}
