import type { LucideIcon } from 'lucide-react';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import { integrationIconTileClass, IntegrationLogo, type LogoDef } from './integrationIcons';

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

function IconTile({ Icon, active }: { Icon: LucideIcon; active: boolean }) {
  return (
    <div className={integrationIconTileClass(active)}>
      <Icon
        className={cn('h-4 w-4', active ? 'text-emerald-300/90' : 'text-zinc-500')}
        aria-hidden
      />
    </div>
  );
}

export function IntegrationCard({
  name,
  description,
  logo,
  Icon,
  status,
  access,
  onReauth,
  reauthLoading,
  variant = 'workspace',
  className,
}: {
  name: string;
  description: string;
  logo?: LogoDef;
  Icon?: LucideIcon;
  status: IntegrationStatusKind;
  access?: { read: boolean; write: boolean; muted?: boolean };
  onReauth?: () => void;
  reauthLoading?: boolean;
  variant?: 'workspace' | 'realtime';
  className?: string;
}) {
  const showAccess = access != null;
  const active = status === 'live' || status === 'on';
  const isWorkspace = variant === 'workspace';

  return (
    <article
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/8 bg-zinc-900/55 p-2 sm:p-2.5 lg:p-3',
        className,
      )}
    >
      <span
        className={cn(
          'absolute top-2 right-2 z-10 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide font-secondary lg:top-2.5 lg:right-2.5',
          STATUS_BADGE[status],
        )}
      >
        {STATUS_LABEL[status]}
      </span>

      <div className="flex shrink-0 items-center gap-1.5 pr-10 sm:gap-2 sm:pr-11 lg:pr-12">
        {logo ? (
          <IntegrationLogo def={logo} active={active} />
        ) : Icon ? (
          <IconTile Icon={Icon} active={active} />
        ) : null}
        <p className="min-w-0 truncate text-xs font-medium text-zinc-100 sm:text-sm">{name}</p>
      </div>

      <p
        className={cn(
          'mt-2 min-h-0 font-secondary',
          isWorkspace
            ? 'integration-card__desc integration-card__desc--workspace line-clamp-2 text-xs leading-snug text-zinc-400'
            : 'integration-card__desc integration-card__desc--realtime settings-only-lg flex-1 overflow-y-auto overscroll-none text-xs leading-relaxed text-zinc-500 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0',
        )}
      >
        {description}
      </p>

      {showAccess ? (
        <div className="integration-card__access mt-auto flex shrink-0 flex-wrap gap-1.5 pt-1.5 lg:pt-2">
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
          className="mt-2 w-full shrink-0 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {reauthLoading ? 'Re-authorizing…' : 'Re-authorize'}
        </button>
      ) : null}
    </article>
  );
}
