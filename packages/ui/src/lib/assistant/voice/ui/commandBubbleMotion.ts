import type { AssistantBubbleStatus, CommandState } from '@dadei/ui/types/command.types';
import {
  COMMAND_TURN_PAIR_LAYOUT_MS,
  VOICE_EASE,
} from '@dadei/ui/lib/assistant/voice/constants';

/** Where the live user bubble sits for a given command phase. */
export type UserBubblePlacement = 'dock' | 'stack';

export type UserBubblePhase = 'thought' | 'settling' | 'settled';

/** Begin warming the follow-up dock this many ms before typewriter / responding ends. */
export const DOCK_POP_LEAD_MS = 1_000;

/**
 * One wake session — user bubble path:
 *
 * idle/locked → (hidden)
 * listening   → dock under mic, live command-blue chrome
 * thinking    → depresses, slides into stack (settling → settled)
 * responding  → user settled in stack; assistant above in its own bubble
 * follow_up   → empty dock pops when responding ends; capture reopens on speech
 */
export function userBubblePlacement(
  state: CommandState,
  hasLiveTurn: boolean,
  opts: {
    isInterim: boolean;
    userText: string;
    followUpListenOpen: boolean;
  },
): UserBubblePlacement | null {
  if (!hasLiveTurn) return null;
  if (state === 'thinking' || state === 'responding') return 'stack';
  if (state === 'listening') return 'dock';
  if (state === 'follow_up') {
    if (opts.isInterim) return 'dock';
    if (opts.followUpListenOpen) return 'dock';
    if (opts.userText.trim()) return 'stack';
    return null;
  }
  return null;
}

export function userBubblePhase(
  _state: CommandState,
  placement: UserBubblePlacement,
): UserBubblePhase {
  if (placement === 'dock') return 'thought';
  return 'settled';
}

export function shouldShowLiveUserBubble(
  placement: UserBubblePlacement | null,
  userText: string,
  followUpListenOpen: boolean,
): boolean {
  if (!placement) return false;
  if (placement === 'dock') return true;
  if (followUpListenOpen) return false;
  return userText.trim().length > 0;
}

/** Assistant bubble visible while thinking; `anchored` latches on once the turn starts. */
export function hasVisibleAssistantContent(
  text: string,
  statusLine: string | null,
  status: AssistantBubbleStatus,
  state: CommandState,
  anchored: boolean,
): boolean {
  if (state !== 'thinking' && state !== 'responding') return false;
  if (text.trim().length > 0) return true;
  if (statusLine?.trim()) return true;
  if (anchored && (status === 'pending' || status === 'streaming' || status === 'revealing')) {
    return true;
  }
  return false;
}

/** True only while the dock bubble should use live command-mode capture chrome. */
export function isUserCaptureLive(
  placement: UserBubblePlacement | null,
  phase: UserBubblePhase,
): boolean {
  return placement === 'dock' && phase === 'thought';
}

/** Shared layout morph — dock ↔ stack within one turn. */
export const BUBBLE_LAYOUT_TRANSITION = {
  type: 'spring' as const,
  stiffness: 195,
  damping: 30,
  mass: 1.12,
};

/** Extra-soft morph when the user bubble leaves the dock for the stack. */
export const DOCK_TO_STACK_LAYOUT_TRANSITION = {
  type: 'tween' as const,
  duration: 1.08,
  ease: VOICE_EASE,
};

/** Single source of truth for command-bubble stack rhythm. */
export const COMMAND_BUBBLE_STACK_SPACING = {
  /** Uniform gap between every bubble in the scroll stack. */
  stackGapPx: 12,
  scrollPaddingPx: 8,
  /** Space between the capture dock and the first stack bubble. */
  dockStackGapPx: 8,
  /** Initial stack inset before the dock is measured (avoids one-frame overlap). */
  dockFallbackMinPx: 92,
} as const;

/** Empty dock placeholder copy. */
export const COMMAND_DOCK_PLACEHOLDER = {
  listening: 'Start speaking to dadei…',
  follow_up: 'Ask a follow-up…',
} as const;

/** @deprecated Use COMMAND_BUBBLE_STACK_SPACING.stackGapPx */
export const LIVE_PAIR_GAP_PX = COMMAND_BUBBLE_STACK_SPACING.stackGapPx;

/** @deprecated Use COMMAND_BUBBLE_STACK_SPACING.stackGapPx */
export const HISTORY_BLOCK_GAP_PX = COMMAND_BUBBLE_STACK_SPACING.stackGapPx;

export function commandBubbleStackStyle(): { gap: number } {
  return { gap: COMMAND_BUBBLE_STACK_SPACING.stackGapPx };
}

/** User lands in the stack before dadei's thinking bubble fades in above. */
export const ASSISTANT_REVEAL_DELAY_MS = 340;

/** Split motion only when response text is streaming — not on thinking entry. */
export const TURN_SPLIT_SPRING = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 32,
  mass: 0.95,
};

export const TURN_SPLIT_ASSISTANT_ORIGIN_Y = 8;
export const TURN_SPLIT_USER_PUSH_PX = 0;

/** Opacity / scale polish on stack entry. */
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
  stiffness: 340,
  damping: 32,
  mass: 0.82,
};

/** @deprecated Use DOCK_POP_* */
export const DOCK_ENTRY_OFFSET_Y = DOCK_POP_ORIGIN_Y;
/** @deprecated Use DOCK_POP_* */
export const DOCK_ENTRY_SCALE = DOCK_POP_ORIGIN_SCALE;

/** Listening ends — gentle settle into the stack (single ease, no bounce). */
export const CAPTURE_RELEASE_DEPRESS_Y = 4;
export const CAPTURE_RELEASE_SCALE = 0.985;
export const CAPTURE_RELEASE_MS = 1.05;

export const DOCK_SLOT_COLLAPSE_MS = 0.72;

/** Mic level → live dock glow intensity (0–1 normalized). */
export function dockGlowFromMicLevel(level: number): number {
  const clamped = Math.min(1, Math.max(0, level));
  return 0.14 + clamped * 0.32;
}
