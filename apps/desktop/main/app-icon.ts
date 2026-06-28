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

/** System tray — transparent mark-in-box. */
export function resolveTrayIcon(): NativeImage | null {
  return loadFirst(candidatePaths('logo-transparent.png')) ?? null;
}

/** Windows/Linux taskbar and window chrome. */
export function resolveWindowIcon(): NativeImage | undefined {
  const image = loadFirst(candidatePaths('logo.png', 'icon.png'));
  return image ?? undefined;
}

/** macOS dock in dev (packaged builds use icon.icns from logo.png). */
export function applyDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) return;
  const image = loadFirst(candidatePaths('logo.png', 'icon.png'));
  if (image) {
    app.dock.setIcon(image);
  }
}
