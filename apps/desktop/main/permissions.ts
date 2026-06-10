import { desktopCapturer, systemPreferences } from 'electron';

export type PermissionKind = 'location' | 'microphone' | 'screen';
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'unsupported';

async function probeScreenCapture(): Promise<PermissionStatus> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
    });
    return sources.length > 0 ? 'granted' : 'denied';
  } catch (error) {
    console.warn('[permissions] screen capture probe failed', error);
    return 'denied';
  }
}

/** Screen + macOS microphone only; location/mic prompts run in the renderer (user gesture). */
export async function checkPermission(kind: PermissionKind): Promise<PermissionStatus> {
  if (kind === 'location') return 'not-determined';
  if (kind === 'microphone') {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      if (status === 'granted') return 'granted';
      if (status === 'denied' || status === 'restricted') return 'denied';
      return 'not-determined';
    }
    return 'not-determined';
  }
  if (kind === 'screen') {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen');
      if (status === 'granted') return 'granted';
      if (status === 'denied' || status === 'restricted') return 'denied';
      return 'not-determined';
    }
    return probeScreenCapture();
  }
  return 'unsupported';
}

export async function requestPermission(kind: PermissionKind): Promise<PermissionStatus> {
  if (kind === 'microphone' && process.platform === 'darwin') {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return granted ? 'granted' : 'denied';
  }
  if (kind === 'screen' && process.platform === 'darwin') {
    // macOS shows the screen-recording prompt when capture is first attempted.
    return probeScreenCapture();
  }
  if (kind === 'location' || kind === 'microphone') return 'not-determined';
  if (kind === 'screen') return probeScreenCapture();
  return 'unsupported';
}

export async function checkAllPermissions(): Promise<Record<PermissionKind, PermissionStatus>> {
  const [location, microphone, screen] = await Promise.all([
    checkPermission('location'),
    checkPermission('microphone'),
    checkPermission('screen'),
  ]);
  return { location, microphone, screen };
}
