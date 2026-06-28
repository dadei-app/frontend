import { app, nativeImage, type NativeImage } from 'electron';
import path from 'path';

function candidatePaths(...segments: string[]): string[] {
  const names = segments.flat();
  const roots = [
    process.resourcesPath,
    path.join(app.getAppPath(), 'resources'),
  ];
  const paths: string[] = [];
  for (const root of roots) {
    for (const name of names) {
      paths.push(path.join(root, name));
    }
  }
  return paths;
}

function loadFirst(paths: string[]): NativeImage | null {
  for (const candidate of paths) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      return image;
    }
  }
  return null;
}

/** System tray — use pre-rendered small assets (legible at 16px). */
export function resolveTrayIcon(): NativeImage | null {
  const trayAsset =
    process.platform === 'win32' ? 'icons/32.png' : 'icons/16.png';
  return (
    loadFirst(candidatePaths(trayAsset, 'icon.png')) ??
    null
  );
}

/** Windows/Linux taskbar and window chrome — rounded squircle. */
export function resolveWindowIcon(): NativeImage | undefined {
  const image = loadFirst(candidatePaths('icons/512.png', 'icon.png'));
  return image ?? undefined;
}

/** macOS dock in dev (packaged builds use icon.icns from the bundle). */
export function applyDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) return;
  // Rounded squircle so the dev dock matches the packaged .icns.
  const image = loadFirst(candidatePaths('icons/512.png', 'icon.png'));
  if (image) {
    app.dock.setIcon(image);
  }
}
