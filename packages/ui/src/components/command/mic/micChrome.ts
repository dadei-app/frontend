export const MIC_SHELL =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] backdrop-blur-xl transition-[border-color,box-shadow] duration-700 ease-in-out';

export const MIC_GLASS = {
  blue: {
    shell: 'border-sky-100/35 ring-1 ring-sky-200/35',
    fill: 'bg-[linear-gradient(132deg,rgba(37,99,235,0.28),rgba(14,165,233,0.25)_45%,rgba(186,230,253,0.22))]',
    glow: 'shadow-[0_0_32px_rgba(37,99,235,0.35),0_0_68px_rgba(14,165,233,0.22)]',
  },
  red: {
    shell: 'border-rose-100/35 ring-1 ring-rose-200/35',
    fill: 'bg-[linear-gradient(132deg,rgba(225,29,72,0.32),rgba(244,63,94,0.26)_45%,rgba(254,205,211,0.18))]',
    glow: 'shadow-[0_0_32px_rgba(225,29,72,0.45),0_0_68px_rgba(244,63,94,0.22)]',
  },
  green: {
    shell: 'border-emerald-100/35 ring-1 ring-emerald-200/35',
    fill: 'bg-[linear-gradient(132deg,rgba(20,184,166,0.28),rgba(16,185,129,0.24)_45%,rgba(167,243,208,0.2))]',
    glow: 'shadow-[0_0_32px_rgba(16,185,129,0.38),0_0_68px_rgba(16,185,129,0.2)]',
  },
} as const;

export type MicGlassTone = keyof typeof MIC_GLASS;

export const MIC_GRAY_LOCKED =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/10 bg-zinc-800/90';

export const MIC_GRAY_LOADING =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/15 bg-zinc-700/80';

export const MIC_GLASS_CROSSFADE = { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const };

export const MIC_GLASS_GLOW_TRANSITION = { duration: 0.22, ease: 'easeOut' as const };
