/** Shared tutorial overlay motion timing (card + backdrop). */
export const TUTORIAL_MORPH_MS = 440;

export const TUTORIAL_MORPH_EASE = 'easeInOut' as const;

export const TUTORIAL_MORPH_TRANSITION = {
  duration: TUTORIAL_MORPH_MS / 1000,
  ease: TUTORIAL_MORPH_EASE,
} as const;
