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
    <div
      className={cn(
        'account-session-actions',
        'col-start-3 col-span-2 row-start-4 row-end-5',
        'flex h-full min-h-0 w-full items-center justify-center',
        'rounded-xl border border-white/10 bg-zinc-950/55 p-6 sm:p-8',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
      )}
    >
      <div className="account-session-actions__grid grid h-full w-full grid-cols-2 items-stretch gap-x-14">
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3.5',
            'text-sm font-medium text-zinc-200 transition emerald-glow',
            'border-white/10 bg-zinc-900/70 hover:border-white/15 hover:bg-zinc-800',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          Sign out
        </button>
        <button
          type="button"
          onClick={onDeleteAccount}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3.5',
            'text-sm font-medium transition',
            'border-rose-500/30 bg-rose-950/40 text-rose-200/90',
            'hover:border-rose-400/40 hover:bg-rose-500/12 hover:text-rose-100',
          )}
        >
          <Trash2 className="h-4 w-4 shrink-0 text-rose-300/80" aria-hidden />
          Delete account
        </button>
      </div>
    </div>
  );
}
