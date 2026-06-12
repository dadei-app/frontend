export type TutorialPlatform = 'desktop-darwin' | 'desktop-win32' | 'desktop-linux' | 'web';

export type ActionTrigger =
  | 'expand-conversation'
  | 'delete-conversation'
  | 'delete-interaction'
  | 'delete-person'
  | 'service-enabled'
  | 'interactions-logged';

export type TutorialCardPlacement = 'auto' | 'left' | 'right' | 'below' | 'above';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** Card position / scroll-into-view anchor. */
  targetKey: string | null;
  /** Card position anchor when different from `targetKey`. */
  cardAnchorKey?: string | null;
  cardPlacement?: TutorialCardPlacement;
  /** Required completions before Next is enabled; empty = Next always enabled. */
  actionTriggers?: ActionTrigger[];
  /** When true, completing an action trigger advances to the next step automatically. */
  autoAdvanceOnAction?: boolean;
  /** Open the persons drawer when this step is active. */
  openPersonsPanel?: boolean;
  /** `data-tutorial-target` keys that accept clicks; default none. */
  interactables?: string[];
  requiredInteractions?: number;
  /** Overlay backdrop blur in px. */
  backdropBlurPx?: number;
  /** Tutorial card panel blur in px; defaults to heavy blur when omitted. */
  cardBackdropBlurPx?: number;
  /** Final step: advancing hands off to the introduction flow. */
  startsIntroduction?: boolean;
}
