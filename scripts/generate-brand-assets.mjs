/**
 * Brand assets, rendered from the canonical UI brand source with sharp.
 *
 *   logo.png             stylized header treatment: mark inside the rounded zinc box
 *   logo-transparent.png bare mark only: dot + pulse waves on transparent
 *
 * Source lives in packages/ui/src/assets. Generated platform copies are written
 * to packages/ui/src/assets, apps/website/public, and apps/desktop/resources.
 * Run: npm run generate:brand
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import opentype from 'opentype.js';
import {
  logoSvg,
  markSvg,
  OG_BACKGROUND,
  POIRET_ONE_FONT_PATH,
  TRANSPARENT,
  WORDMARK,
  WORDMARK_FILL,
} from '../packages/ui/src/assets/brand-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_ASSETS = join(ROOT, 'packages/ui/src/assets');
const PUBLIC = join(ROOT, 'apps/website/public');
const RESOURCES = join(ROOT, 'apps/desktop/resources');
const OUTPUTS = [UI_ASSETS, PUBLIC, RESOURCES];

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

// og-image — branded lockup: stylized mark + outlined Poiret One "dadei" wordmark,
// centered on a zinc card. Text is outlined to paths so no system font is required.
{
  const OG_W = 1200;
  const OG_H = 630;
  const markPx = 240;
  const fontSize = 200;
  const gap = 48;

  const fontBuf = readFileSync(POIRET_ONE_FONT_PATH);
  const font = opentype.parse(
    fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength),
  );

  const tracking = fontSize * 0.2;
  const glyphs = [];
  let cursor = 0;
  for (const char of WORDMARK) {
    glyphs.push(font.getPath(char, cursor, 0, fontSize));
    cursor += font.getAdvanceWidth(char, fontSize) + tracking;
  }
  const totalW = cursor - tracking;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of glyphs) {
    const { x1, y1, x2, y2 } = g.getBoundingBox();
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }
  maxX = Math.max(maxX, totalW);

  const pad = 4;
  const svgW = Math.ceil(maxX - minX + pad * 2);
  const svgH = Math.ceil(maxY - minY + pad * 2);
  const paths = glyphs.map((g) => `<path d="${g.toPathData(2)}" fill="${WORDMARK_FILL}" />`).join('\n    ');
  const wordSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="${minX - pad} ${minY - pad} ${svgW} ${svgH}">
    ${paths}
  </svg>`;
  const wordBuf = await sharp(Buffer.from(wordSvg)).png().toBuffer();
  const wordMeta = await sharp(wordBuf).metadata();

  const markBuf = await sharp(Buffer.from(logoSvg(markPx))).png().toBuffer();

  const lockupW = markPx + gap + wordMeta.width;
  const left = Math.round((OG_W - lockupW) / 2);

  await sharp({
    create: { width: OG_W, height: OG_H, channels: 4, background: OG_BACKGROUND },
  })
    .composite([
      { input: markBuf, left, top: Math.round((OG_H - markPx) / 2) },
      {
        input: wordBuf,
        left: left + markPx + gap,
        top: Math.round((OG_H - wordMeta.height) / 2),
      },
    ])
    .png()
    .toFile(join(PUBLIC, 'og-image.png'));
}

rmSync(join(RESOURCES, 'icons'), { recursive: true, force: true });

console.log('Generated logo.png + logo-transparent.png in ui/assets, website/public, desktop/resources');
