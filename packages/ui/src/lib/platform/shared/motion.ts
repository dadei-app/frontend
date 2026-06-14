/** Shared motion presets for consistent assistant UI animation. */
export const veilEase = [0.22, 1, 0.36, 1] as const;

export const transitionFast = {
  duration: 0.22,
  ease: veilEase,
} as const;

export const teardropEnter = {
  duration: 0.22,
  ease: veilEase,
} as const;

export const teardropExit = {
  duration: 0.18,
  ease: veilEase,
} as const;
