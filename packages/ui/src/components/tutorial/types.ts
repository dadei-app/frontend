export type Platform = 'desktop-darwin' | 'desktop-win32' | 'desktop-linux' | 'web';

export type StepKind = 'spotlight' | 'action';

export type ActionTrigger =
  | 'permission-resolved'
  | 'expand-conversation'
  | 'notifications-dismissed'
  | 'delete-interaction'
  | 'delete-person'
  | 'service-enabled'
  | 'wake-session-ended'
  | 'interactions-logged';

export type TutorialCardPlacement = 'auto' | 'left' | 'right' | 'below' | 'above';

export interface TutorialStep {
  id: string;
  kind: StepKind;
  title: string;
  body: string;
  /** Action cutout / arrow target. */
  targetKey: string | null;
  /** Card position anchor when different from `targetKey`. */
  cardAnchorKey?: string | null;
  cardPlacement?: TutorialCardPlacement;
  actionTrigger?: ActionTrigger;
  /** When true, completing the action trigger advances to the next step automatically. */
  autoAdvanceOnAction?: boolean;
  /** Open the persons drawer when this step is active. */
  openPersonsPanel?: boolean;
  /** data-tutorial-target keys that accept clicks during action steps (defaults to targetKey). */
  allowedClickTargets?: string[];
  requiredInteractions?: number;
  /** Overlay backdrop blur in px; action steps default to 0, spotlight to 12. */
  backdropBlurPx?: number;
}
