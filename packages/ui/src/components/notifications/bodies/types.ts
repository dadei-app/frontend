import type { ActionOperation } from '@dadei/ui/types/models.types';

export type BannerContentProps = {
  actionType: string;
  operation?: ActionOperation;
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
};

export type SideEffectDeleteBodyProps = {
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  compact?: boolean;
};

export type EmailBodyProps = {
  title: string;
  toolArgs?: Record<string, unknown>;
};

export type CalendarEventBodyProps = {
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
  operation?: ActionOperation;
};
