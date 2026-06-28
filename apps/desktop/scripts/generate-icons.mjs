import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(__dirname, '..');
const websitePublic = join(desktopRoot, '..', 'website', 'public');
const markSvgPath = join(__dirname, 'dadei-mark.svg');
const appIconSvgPath = join(__dirname, 'dadei-icon.svg');
const lockupSvgPath = join(__dirname, 'dadei-lockup.svg');
const resourcesDir = join(desktopRoot, 'resources');
const iconsDir = join(resourcesDir, 'icons');

const markSvg = readFileSync(markSvgPath);
const appIconSvg = readFileSync(appIconSvgPath);

const opaqueZinc = { r: 9, g: 9, b: 11, alpha: 1 };
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

rmSync(iconsDir, { recursive: true, force: true });
mkdirSync(iconsDir, { recursive: true });

// Tray icons: full-bleed mark on opaque zinc — at 16/32px the squircle margins would shrink
// the mark and the rounding is imperceptible, so legibility wins here.
for (const size of [16, 32]) {
  await sharp(markSvg, { density: 300 })
    .resize(size, size, { fit: 'contain', background: opaqueZinc })
    .png()
    .toFile(join(iconsDir, `${size}.png`));
}

// App/launcher/taskbar/dock icons: rounded squircle with transparent margins, shared across
// macOS / Windows / Linux.
for (const size of [256, 512]) {
  await sharp(appIconSvg, { density: 300 })
    .resize(size, size, { fit: 'contain', background: transparent })
    .png()
    .toFile(join(iconsDir, `${size}.png`));
}

// Generic app icon (Linux build.icon + extraResources copy).
await sharp(appIconSvg, { density: 300 })
  .resize(512, 512, { fit: 'contain', background: transparent })
  .png()
  .toFile(join(resourcesDir, 'icon.png'));

// Windows .ico: full-bleed mark for small sizes (legibility), rounded squircle for large.
const icoBuffer = await pngToIco([
  join(iconsDir, '16.png'),
  join(iconsDir, '32.png'),
  join(iconsDir, '256.png'),
  join(iconsDir, '512.png'),
]);
writeFileSync(join(resourcesDir, 'icon.ico'), icoBuffer);

if (process.platform === 'darwin') {
  const iconsetDir = join(resourcesDir, 'icon.iconset');
  mkdirSync(iconsetDir, { recursive: true });
  const icnsSizes = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ];
  for (const [size, name] of icnsSizes) {
    await sharp(appIconSvg, { density: 300 })
      .resize(size, size, { fit: 'contain', background: transparent })
      .png()
      .toFile(join(iconsetDir, name));
  }
  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', join(resourcesDir, 'icon.icns')]);
  rmSync(iconsetDir, { recursive: true, force: true });
}

if (existsSync(lockupSvgPath)) {
  mkdirSync(websitePublic, { recursive: true });
  await sharp(lockupSvgPath, { density: 200 })
    .resize(1200, 630, { fit: 'contain', background: opaqueZinc })
    .png()
    .toFile(join(websitePublic, 'og-image.png'));
}

console.log('Generated desktop icons and website raster assets.');
