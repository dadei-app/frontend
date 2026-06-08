import { session } from 'electron';

const AUTO_ALLOW = new Set([
  'geolocation',
  'media',
  'display-capture',
  'screen',
  'audioCapture',
  'videoCapture',
  'notifications',
]);

/** Allow Chromium permission prompts used by geolocation, mic, and screen capture. */
export function configureSessionPermissions(): void {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(AUTO_ALLOW.has(permission));
  });

  ses.setPermissionCheckHandler((_webContents, permission) => {
    return AUTO_ALLOW.has(permission);
  });
}
