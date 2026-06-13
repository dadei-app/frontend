import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@dadei/ui/lib/platform/shared/cn';

export type SettingsPanelProps = {
  pendingAction?: string;
  onActionConsumed?: () => void;
};

export type SettingsLayoutId = 'integrations' | 'account' | 'audio' | 'memories' | 'startup';

export const settingsInputClass =
  'w-full rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-3 text-base text-zinc-100 emerald-glow';

/** Read-only fields (e.g. account email). */
export const settingsReadonlyFieldClass =
  'w-full cursor-default rounded-lg border border-white/8 bg-zinc-900/30 px-4 py-3 text-center text-sm text-zinc-500';

export const settingsButtonClass =
  'rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2.5 text-base text-zinc-200 transition hover:bg-zinc-800';

export const settingsPrimaryButtonClass =
  'rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-base text-emerald-200 transition hover:bg-emerald-500/20';

/** Responsive bento grid for subscription / centered panels. */
export function SettingsBento({
  children,
  centered = false,
  className,
}: {
  children: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  if (centered) {
    return (
      <div
        className={cn(
          'flex min-h-[min(100%,36rem)] w-full flex-col items-center justify-center gap-6 px-2 py-6 text-center',
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid w-full min-w-0 auto-rows-min gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

type GridUnit = 1 | 2 | 3 | 4;

const tileShell =
  'settings-tile relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950/55 p-4';

/**
 * Panel grid — CSS-driven layouts use `layout` + `data-tile` ids (settings-responsive.css).
 * Account keeps the reference inline 4×4 grid from col/row placement (no `layout` prop).
 */
export function SettingsGrid4({
  layout,
  children,
  className,
}: {
  layout?: SettingsLayoutId;
  children: ReactNode;
  className?: string;
}) {
  if (!layout) {
    return (
      <div
        className={cn('settings-account-grid', className)}
      >
        {children}
      </div>
    );
  }

  return (
    <div data-settings-layout={layout} className={cn('settings-panel-grid', className)}>
      {children}
    </div>
  );
}

export function GridTile({
  tile,
  col,
  row,
  colSpan = 1,
  rowSpan = 1,
  children,
  title,
  hint,
  headerAction,
  className,
  bodyClassName,
  scrollable = false,
  stacked = false,
}: {
  tile?: string;
  col?: GridUnit;
  row?: GridUnit;
  colSpan?: GridUnit;
  rowSpan?: GridUnit;
  children: ReactNode;
  title?: string;
  hint?: string;
  headerAction?: ReactNode;
  className?: string;
  bodyClassName?: string;
  scrollable?: boolean;
  stacked?: boolean;
}) {
  const usesPlacement = col != null && row != null;
  const style: CSSProperties | undefined = usesPlacement
    ? {
        gridColumn: `${col} / span ${colSpan}`,
        gridRow: `${row} / span ${rowSpan}`,
      }
    : undefined;

  return (
    <div data-tile={tile} className={cn(tileShell, className)} style={style}>
      {(title || hint || headerAction) && (
        <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            {title ? <h3 className="text-sm font-medium text-zinc-100">{title}</h3> : null}
            {hint ? (
              <p
                className={cn(
                  usesPlacement ? 'text-xs text-zinc-500 font-secondary' : 'settings-tile-hint text-xs text-zinc-500 font-secondary',
                  title && 'mt-0.5',
                )}
              >
                {hint}
              </p>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      )}
      <div
        className={cn(
          stacked
            ? 'flex w-full flex-col'
            : usesPlacement
              ? 'flex min-h-0 flex-1 flex-col'
              : 'settings-tile-body',
          scrollable && 'settings-tile-body--scroll',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
