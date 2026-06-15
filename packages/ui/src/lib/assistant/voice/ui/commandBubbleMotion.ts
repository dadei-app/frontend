import type { CommandState } from '@dadei/ui/types/command.types';
import {
  COMMAND_TURN_PAIR_LAYOUT_MS,
  VOICE_EASE,
} from '@dadei/ui/lib/assistant/voice/constants';

/** Where the live user bubble sits for a given command phase. */
export type UserBubblePlacement = 'dock' | 'stack';

export type UserBubblePhase = 'thought' | 'settling' | 'settled';

/**
 * One wake session — user bubble path:
 *
 * idle/locked → (hidden)
 * listening   → dock under mic, live command-blue chrome, caret / interim text
 * thinking    → depresses, loses emerald, slides into stack top (settling → settled)
 * responding  → user settled in stack, assistant streams / typewrites below
 * follow_up   → submitted user text stays settled in stack while assistant finishes;
 *               dock only reopens on fresh interim capture
 */
export function userBubblePlacement(
  state: CommandState,
  hasLiveTurn: boolean,
  opts: { isInterim: boolean; userText: string },
): UserBubblePlacement | null {
  if (!hasLiveTurn) return null;
  if (state === 'thinking' || state === 'responding') return 'stack';
  if (state === 'listening') return 'dock';
  if (state === 'follow_up') {
    if (opts.isInterim) return 'dock';
    if (opts.userText.trim()) return 'stack';
    return null;
  }
  return null;
}

export function userBubblePhase(
  state: CommandState,
  placement: UserBubblePlacement,
): UserBubblePhase {
  if (placement === 'dock') return 'thought';
  if (state === 'thinking') return 'settling';
  return 'settled';
}

export function shouldShowLiveUserBubble(
  placement: UserBubblePlacement | null,
  userText: string,
): boolean {
  if (!placement) return false;
  if (placement === 'dock') return true;
  return userText.trim().length > 0;
}

/** True only while the dock bubble should use live command-mode capture chrome. */
export function isUserCaptureLive(
  placement: UserBubblePlacement | null,
  phase: UserBubblePhase,
): boolean {
  return placement === 'dock' && phase === 'thought';
}

export function isAssistantLive(state: CommandState): boolean {
  return state === 'thinking' || state === 'responding';
}

/** Shared layout morph — dock ↔ stack within one turn. */
export const BUBBLE_LAYOUT_TRANSITION = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 34,
  mass: 0.88,
};

/** Opacity / scale polish on dock entry and stack settle. */
export const BUBBLE_PRESENCE_TRANSITION = {
  duration: COMMAND_TURN_PAIR_LAYOUT_MS,
  ease: VOICE_EASE,
};

/** Dock pops outward from the mic anchor (origin ≈ mic center above the slot). */
export const DOCK_POP_ORIGIN_Y = -88;
export const DOCK_POP_ORIGIN_SCALE = 0.26;
export const DOCK_POP_ORIGIN_BLUR_PX = 5;
export const DOCK_POP_SPRING = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 27,
  mass: 0.68,
};

/** @deprecated Use DOCK_POP_* — kept for imports that haven't migrated. */
export const DOCK_ENTRY_OFFSET_Y = DOCK_POP_ORIGIN_Y;
/** @deprecated Use DOCK_POP_* */
export const DOCK_ENTRY_SCALE = DOCK_POP_ORIGIN_SCALE;

/** Listening ends — bubble depresses and sheds capture chrome before joining the stack. */
export const CAPTURE_RELEASE_DEPRESS_Y = 4;
export const CAPTURE_RELEASE_SCALE = 0.975;
export const CAPTURE_RELEASE_MS = 0.42;

/** Live dock breathing — subtle idle pulse layered under mic reactivity. */
export const DOCK_BREATHE_SCALE = [1, 1.012, 1] as const;
export const DOCK_BREATHE_DURATION_S = 2.8;

/** Mic level → live dock glow intensity (0–1 normalized). */
export function dockGlowFromMicLevel(level: number): number {
  const clamped = Math.min(1, Math.max(0, level));
  return 0.14 + clamped * 0.32;
}
