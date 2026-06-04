import type {
  DesktopPermissionKind,
  DesktopPermissionStatus,
} from '@dadei/ui/types/electron';

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
        { enableHighAccuracy: false, timeout: 12_000, maximumAge: 0 },
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
