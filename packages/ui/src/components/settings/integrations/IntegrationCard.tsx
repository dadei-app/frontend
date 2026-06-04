import type { LucideIcon } from 'lucide-react';
import { cn } from '@dadei/ui/lib/shared/cn';

export type IntegrationStatusKind = 'live' | 'on' | 'off' | 'reauth';

const STATUS_BADGE: Record<IntegrationStatusKind, string> = {
  live: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  on: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  off: 'border-zinc-600/80 bg-zinc-800/80 text-zinc-400',
  reauth: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
};

const STATUS_LABEL: Record<IntegrationStatusKind, string> = {
  live: 'Live',
  on: 'On',
  off: 'Off',
  reauth: 'Re-auth',
};

function accessBadgeClass(granted: boolean, muted: boolean): string {
  if (granted) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (muted) return 'border-zinc-700 bg-zinc-800/80 text-zinc-500';
  return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
}

export function IntegrationCard({
  name,
  description,
  Icon,
  status,
  access,
  onReauth,
  reauthLoading,
  variant = 'workspace',
}: {
  name: string;
  description: string;
  Icon: LucideIcon;
  status: IntegrationStatusKind;
  access?: { read: boolean; write: boolean; muted?: boolean };
  onReauth?: () => void;
  reauthLoading?: boolean;
  variant?: 'workspace' | 'realtime';
}) {
  const showAccess = access != null;
  const active = status === 'live' || status === 'on';
  const isWorkspace = variant === 'workspace';

  return (
    <article
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/8 bg-zinc-900/55',
        isWorkspace ? 'h-full p-2.5' : 'h-auto p-2',
      )}
    >
      <span
        className={cn(
          'absolute right-2 top-2 z-10 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide font-secondary',
          STATUS_BADGE[status],
        )}
      >
        {STATUS_LABEL[status]}
      </span>

      <div className="flex shrink-0 items-center gap-2 pr-14">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg border',
            isWorkspace ? 'h-8 w-8' : 'h-7 w-7',
            active ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-white/10 bg-zinc-950/80',
          )}
        >
          <Icon
            className={cn(
              isWorkspace ? 'h-4 w-4' : 'h-3.5 w-3.5',
              active ? 'text-emerald-300/90' : 'text-zinc-500',
            )}
            aria-hidden
          />
        </div>
        <p className="min-w-0 truncate text-sm font-medium leading-tight text-zinc-100">{name}</p>
      </div>

      <p
        className={cn(
          'mt-1.5 text-[11px] leading-[1.4] text-zinc-500 font-secondary',
          isWorkspace ? 'line-clamp-3 min-h-0 flex-1' : 'line-clamp-2 shrink-0',
        )}
      >
        {description}
      </p>

      {showAccess ? (
        <div className="mt-1.5 flex shrink-0 flex-wrap gap-1">
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium font-secondary',
              accessBadgeClass(access.read, Boolean(access.muted)),
            )}
          >
            Read
          </span>
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium font-secondary',
              accessBadgeClass(access.write, Boolean(access.muted)),
            )}
          >
            Write
          </span>
        </div>
      ) : null}

      {status === 'reauth' && onReauth ? (
        <button
          type="button"
          onClick={onReauth}
          disabled={reauthLoading}
          className="mt-1.5 w-full shrink-0 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {reauthLoading ? 'Re-authorizing…' : 'Re-authorize'}
        </button>
      ) : null}
    </article>
  );
}
