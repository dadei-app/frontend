import type { BannerItem } from '@dadei/ui/contexts/NotificationContext';

/** Vertical offset between stacked layers (px). */
export const BANNER_LAYER_STEP_PX = 14;
/** Width reduction per layer toward the top of the stack. */
export const BANNER_LAYER_SCALE_STEP = 0.045;
/** Stagger between simultaneous arrivals (ms). */
export const BANNER_STACK_STAGGER_MS = 70;
/** Short slide for the active (front) card — avoids the full pouch travel delay. */
export const BANNER_ACTIVE_ENTER_TRAVEL_PX = 36;
/** How far above the target slot a new card begins its entrance (× layer step). */
export const BANNER_ENTER_TRAVEL_MULT = 2.5;
/** Fixed rendered card height — banners clamp here so the stack stays aligned. */
export const BANNER_CARD_HEIGHT_PX = 168;
/** Same clamp used for pouch travel so exit animations clear the header lip. */
export const BANNER_HIDE_HEIGHT_PX = BANNER_CARD_HEIGHT_PX;
/** Slide distance so a card fully clears the slot on enter/exit (pouch animation). */
export const BANNER_POUCH_TRAVEL_PX = BANNER_CARD_HEIGHT_PX + 12;
/** Distance from header bottom to the banner anchor (`pt-6` + `top-4` in assistant layout). */
export const ASSISTANT_BANNER_ANCHOR_OFFSET_PX = 40;

/** Upward travel so the card is entirely above the header bottom (fully hidden under header). */
export function bannerPouchTravelPx(
  slotY: number,
  cardHeightPx = BANNER_HIDE_HEIGHT_PX,
): number {
  return ASSISTANT_BANNER_ANCHOR_OFFSET_PX + slotY + cardHeightPx + 4;
}

/** Lively spring for incoming cards — slight overshoot at settle. */
export const BANNER_ENTER_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 29,
  mass: 0.82,
};

/** Heavier spring for pushed cards — ease-in-out feel, no bounce. */
export const BANNER_PUSH_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 44,
  mass: 1.05,
};

export type StackBanner = BannerItem & {
  isActive: boolean;
  /** 0 = top of stack (newest pending), increases toward the active card at the bottom. */
  slotFromTop: number;
};

/**
 * Build visual stack order: newest pending at top → oldest pending → active at bottom.
 * Action queue from the server is [active, pending FIFO…]; manual banners join as pending.
 */
export function buildStackBanners(
  actionBanners: BannerItem[],
  manualBanners: BannerItem[],
): StackBanner[] {
  const actionActive = actionBanners.find((b) => !b.queued) ?? null;
  const actionPendingOldestFirst = actionBanners.filter((b) => b.queued);

  const manuals = manualBanners.filter(
    (m) => !actionBanners.some((a) => a.id === m.id),
  );

  let active: BannerItem | null = actionActive;
  let pendingNewestFirst: BannerItem[] = [];

  if (active) {
    pendingNewestFirst = [
      ...manuals.slice().reverse(),
      ...actionPendingOldestFirst.slice().reverse(),
    ];
  } else if (manuals.length > 0) {
    active = manuals[0];
    pendingNewestFirst = manuals.slice(1).reverse();
  }

  if (!active) return [];

  const ordered = [...pendingNewestFirst, active];
  return ordered.map((banner, slotFromTop) => ({
    ...banner,
    isActive: slotFromTop === ordered.length - 1,
    slotFromTop,
    queued: slotFromTop !== ordered.length - 1,
  }));
}

export function stackLayoutForSlot(slotFromTop: number, total: number) {
  const layersAbove = total - 1 - slotFromTop;
  return {
    y: slotFromTop * BANNER_LAYER_STEP_PX,
    scale: Math.max(1 - layersAbove * BANNER_LAYER_SCALE_STEP, 0.72),
    zIndex: slotFromTop + 1,
  };
}

export function stackContainerHeight(total: number, cardHeightPx = BANNER_CARD_HEIGHT_PX) {
  if (total <= 0) return 0;
  return cardHeightPx + (total - 1) * BANNER_LAYER_STEP_PX;
}
