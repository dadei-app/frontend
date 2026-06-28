/**
 * Brand assets, rendered from SVG with sharp.
 *
 *   logo.png             stylized header treatment: mark inside the rounded zinc box
 *   logo-transparent.png bare mark only: dot + pulse waves on transparent
 *
 * Written to packages/ui/src/assets, apps/website/public, apps/desktop/resources.
 * Run: npm run generate:brand
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_ASSETS = join(ROOT, 'packages/ui/src/assets');
const PUBLIC = join(ROOT, 'apps/website/public');
const RESOURCES = join(ROOT, 'apps/desktop/resources');
const OUTPUTS = [UI_ASSETS, PUBLIC, RESOURCES];

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const GRADIENT = `
  <linearGradient id="em" x1="20" y1="14" x2="80" y2="88" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#5cf0b0" />
    <stop offset="0.55" stop-color="#00cc6a" />
    <stop offset="1" stop-color="#00a85a" />
  </linearGradient>`;

// dot + pulse waves, authored in a 0..100 space.
const MARK = `
  <path d="M34.5 78.85 A31 31 0 1 1 65.5 78.85" fill="none" stroke="url(#em)" stroke-width="3.4" stroke-linecap="round" opacity="0.42" />
  <path d="M40 69.32 A20 20 0 1 1 60 69.32" fill="none" stroke="url(#em)" stroke-width="3.9" stroke-linecap="round" opacity="0.82" />
  <circle cx="50" cy="52" r="8" fill="url(#em)" />`;

/** Bare mark, transparent background. */
function markSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>${GRADIENT}</defs>
    ${MARK}
  </svg>`;
}

/**
 * Flat zinc box with a beveled gradient border and a single mark lifted by a soft
 * drop shadow (no ghost/double-layer). Mark fills most of the square.
 */
function logoSvg(size) {
  const radius = Math.round(size * 0.22);
  const inset = Math.round(size * 0.085); // ~83% mark coverage
  const markScale = (size - inset * 2) / 100;
  const ring = Math.max(2, Math.round(size * 0.016));
  const ringOffset = ring / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${GRADIENT}
      <linearGradient id="edge" x1="0" y1="0" x2="0" y2="${size}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#52525b" stop-opacity="0.9" />
        <stop offset="0.5" stop-color="#27272a" stop-opacity="0.5" />
        <stop offset="1" stop-color="#000000" stop-opacity="0.65" />
      </linearGradient>
      <filter id="markShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="0.9" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.55" />
      </filter>
    </defs>
    <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" fill="#18181b" />
    <g transform="translate(${inset}, ${inset}) scale(${markScale})" filter="url(#markShadow)">${MARK}</g>
    <rect x="${ringOffset}" y="${ringOffset}" width="${size - ring}" height="${size - ring}" rx="${radius - ringOffset}" fill="none" stroke="url(#edge)" stroke-width="${ring}" />
  </svg>`;
}

for (const dir of OUTPUTS) {
  mkdirSync(dir, { recursive: true });
}

const logo512 = await sharp(Buffer.from(logoSvg(512))).png().toBuffer();
const markTransparent512 = await sharp(Buffer.from(markSvg(512))).png().toBuffer();

for (const dir of OUTPUTS) {
  writeFileSync(join(dir, 'logo.png'), logo512);
  writeFileSync(join(dir, 'logo-transparent.png'), markTransparent512);
}

// Electron generic icon + platform packaging icons all use the stylized logo.
writeFileSync(join(RESOURCES, 'icon.png'), logo512);

const icon16 = await sharp(Buffer.from(logoSvg(16))).png().toBuffer();
const icon32 = await sharp(Buffer.from(logoSvg(32))).png().toBuffer();
const icon256 = await sharp(Buffer.from(logoSvg(256))).png().toBuffer();
writeFileSync(join(RESOURCES, 'icon.ico'), await pngToIco([icon16, icon32, icon256, logo512]));

if (process.platform === 'darwin') {
  const iconsetDir = join(RESOURCES, 'icon.iconset');
  rmSync(iconsetDir, { recursive: true, force: true });
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
    await sharp(Buffer.from(logoSvg(size))).png().toFile(join(iconsetDir, name));
  }
  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', join(RESOURCES, 'icon.icns')]);
  rmSync(iconsetDir, { recursive: true, force: true });
}

await sharp({
  create: { width: 1200, height: 630, channels: 4, background: { r: 9, g: 9, b: 11, alpha: 1 } },
})
  .composite([{ input: await sharp(Buffer.from(logoSvg(280))).png().toBuffer(), gravity: 'centre' }])
  .png()
  .toFile(join(PUBLIC, 'og-image.png'));

rmSync(join(RESOURCES, 'icons'), { recursive: true, force: true });

console.log('Generated logo.png + logo-transparent.png in ui/assets, website/public, desktop/resources');
