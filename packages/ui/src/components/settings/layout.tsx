import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@dadei/ui/lib/shared/cn';

export type SettingsPanelProps = {
  pendingAction?: string;
  onActionConsumed?: () => void;
};

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
  'relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950/55 p-4';

/** Fixed 4×4 grid that fills the settings content area. */
export function SettingsGrid4({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-4 gap-3',
        '[grid-template-rows:repeat(4,minmax(0,1fr))]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GridTile({
  children,
  title,
  hint,
  col,
  row,
  colSpan = 1,
  rowSpan = 1,
  headerAction,
  className,
  bodyClassName,
}: {
  children: ReactNode;
  title?: string;
  hint?: string;
  col: GridUnit;
  row: GridUnit;
  colSpan?: GridUnit;
  rowSpan?: GridUnit;
  headerAction?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const style: CSSProperties = {
    gridColumn: `${col} / span ${colSpan}`,
    gridRow: `${row} / span ${rowSpan}`,
  };

  return (
    <div className={cn(tileShell, className)} style={style}>
      {(title || hint || headerAction) && (
        <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            {title ? <h3 className="text-sm font-medium text-zinc-100">{title}</h3> : null}
            {hint ? (
              <p className={cn('text-xs text-zinc-500 font-secondary', title && 'mt-0.5')}>
                {hint}
              </p>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      )}
      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </div>
  );
}
