export const MIC_SHELL =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] transition-[border-color,box-shadow] duration-700 ease-in-out';

/** Soft outer halo — simple 2-stop radials + heavy blur (multi-stop gradients band before blur). */
export type MicGlowHaloLayer = {
  inset: string;
  background: string;
  blurPx: number;
};

export const MIC_GLASS = {
  blue: {
    shell: 'border-sky-100/30',
    fill: 'bg-[linear-gradient(132deg,rgba(37,99,235,0.28),rgba(14,165,233,0.25)_45%,rgba(186,230,253,0.22))]',
  },
  red: {
    shell: 'border-rose-100/30',
    fill: 'bg-[linear-gradient(132deg,rgba(225,29,72,0.32),rgba(244,63,94,0.26)_45%,rgba(254,205,211,0.18))]',
  },
  green: {
    shell: 'border-emerald-100/30',
    fill: 'bg-[linear-gradient(132deg,rgba(20,184,166,0.28),rgba(16,185,129,0.24)_45%,rgba(167,243,208,0.2))]',
  },
} as const;

export type MicGlassTone = keyof typeof MIC_GLASS;

export const MIC_GLOW_HALO: Record<MicGlassTone, MicGlowHaloLayer[]> = {
  blue: [
    {
      inset: '-3.5rem',
      background: 'radial-gradient(circle at center, rgba(14,165,233,0.38) 0%, transparent 68%)',
      blurPx: 26,
    },
    {
      inset: '-5.5rem',
      background: 'radial-gradient(circle at center, rgba(37,99,235,0.16) 0%, transparent 72%)',
      blurPx: 38,
    },
  ],
  red: [
    {
      inset: '-3.5rem',
      background: 'radial-gradient(circle at center, rgba(244,63,94,0.42) 0%, transparent 68%)',
      blurPx: 26,
    },
    {
      inset: '-5.5rem',
      background: 'radial-gradient(circle at center, rgba(225,29,72,0.18) 0%, transparent 72%)',
      blurPx: 38,
    },
  ],
  green: [
    {
      inset: '-3rem',
      background: 'radial-gradient(circle at center, rgba(16,185,129,0.31) 0%, transparent 68%)',
      blurPx: 23,
    },
    {
      inset: '-4.5rem',
      background: 'radial-gradient(circle at center, rgba(16,185,129,0.12) 0%, transparent 72%)',
      blurPx: 33,
    },
  ],
};

export const MIC_GRAY_LOCKED =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/10 bg-zinc-800/90';

export const MIC_GRAY_LOADING =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/15 bg-zinc-700/80';

export const MIC_GLASS_CROSSFADE = { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const };

export const MIC_GLASS_GLOW_TRANSITION = { duration: 0.22, ease: 'easeOut' as const };
