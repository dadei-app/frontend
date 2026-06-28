import { fileURLToPath } from 'node:url';

export const WORDMARK = 'dadei';
export const WORDMARK_FILL = '#f4f4f5';
export const OG_BACKGROUND = { r: 9, g: 9, b: 11, alpha: 1 };
export const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
export const POIRET_ONE_FONT_PATH = fileURLToPath(new URL('./fonts/PoiretOne-Regular.ttf', import.meta.url));

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
export function markSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>${GRADIENT}</defs>
    ${MARK}
  </svg>`;
}

/**
 * Flat zinc box with a beveled gradient border and a single mark lifted by a soft
 * drop shadow (no ghost/double-layer). Mark fills most of the square.
 */
export function logoSvg(size) {
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
