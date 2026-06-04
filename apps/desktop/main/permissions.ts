import { desktopCapturer, systemPreferences, type BrowserWindow } from 'electron';

export type PermissionKind = 'location' | 'microphone' | 'screen';
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'unsupported';

let getMainWindow: () => BrowserWindow | null = () => null;

export function bindPermissionsMainWindow(getter: () => BrowserWindow | null): void {
  getMainWindow = getter;
}

function activeWindow(): BrowserWindow | null {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return null;
  return win;
}

async function runInRenderer<T>(script: string): Promise<T | 'unsupported'> {
  const win = activeWindow();
  if (!win) return 'unsupported';
  try {
    return (await win.webContents.executeJavaScript(script, true)) as T;
  } catch (error) {
    console.warn('[permissions] renderer probe failed', error);
    return 'unsupported';
  }
}

async function probeGeolocation(): Promise<PermissionStatus> {
  const result = await runInRenderer<PermissionStatus>(`
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('unsupported');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (err) => resolve(err && err.code === 1 ? 'denied' : 'not-determined'),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
      );
    })
  `);
  return result === 'unsupported' ? 'unsupported' : result;
}

async function probeMicrophone(): Promise<PermissionStatus> {
  const result = await runInRenderer<PermissionStatus>(`
    new Promise(async (resolve) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        resolve('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        resolve('granted');
      } catch (err) {
        resolve(err && err.name === 'NotAllowedError' ? 'denied' : 'not-determined');
      }
    })
  `);
  return result === 'unsupported' ? 'unsupported' : result;
}

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

export async function checkPermission(kind: PermissionKind): Promise<PermissionStatus> {
  if (kind === 'location') return probeGeolocation();
  if (kind === 'microphone') {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      if (status === 'granted') return 'granted';
      if (status === 'denied' || status === 'restricted') return 'denied';
      return 'not-determined';
    }
    return probeMicrophone();
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
  if (kind === 'location') return probeGeolocation();
  if (kind === 'microphone') return probeMicrophone();
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
