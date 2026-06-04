export type Platform = 'desktop-darwin' | 'desktop-win32' | 'desktop-linux' | 'web';

export type StepKind = 'spotlight' | 'action';

export type ActionTrigger =
  | 'click'
  | 'permission-resolved'
  | 'delete-interaction'
  | 'delete-conversation'
  | 'delete-person'
  | 'service-enabled'
  | 'wake-session-ended'
  | 'interactions-logged';

export interface TutorialStep {
  id: string;
  kind: StepKind;
  title: string;
  body: string;
  targetKey: string | null;
  actionTrigger?: ActionTrigger;
  requiredInteractions?: number;
}
