import { LogOut, Trash2 } from 'lucide-react';
import { cn } from '@dadei/ui/lib/shared/cn';

export function AccountSessionActions({
  onLogout,
  onDeleteAccount,
}: {
  onLogout: () => void;
  onDeleteAccount: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-zinc-500 font-secondary">
        Sign out on this device or permanently remove your network.
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-white/12 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-300 transition',
            'hover:border-white/18 hover:bg-zinc-800 hover:text-zinc-100',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          Sign out
        </button>
        <button
          type="button"
          onClick={onDeleteAccount}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-950/50 px-4 py-2 text-sm font-medium text-rose-200/95 transition',
            'hover:border-rose-400/45 hover:bg-rose-500/15 hover:text-rose-100',
          )}
        >
          <Trash2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Delete account
        </button>
      </div>
    </div>
  );
}
