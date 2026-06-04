import { cn } from '@dadei/ui/lib/shared/cn';

export function AssistantHotkeyControl({
  displayLabel,
  capturing,
  onStartCapture,
  onCancelCapture,
  onReset,
  showReset,
  compact = false,
}: {
  displayLabel: string;
  capturing: boolean;
  onStartCapture: () => void;
  onCancelCapture: () => void;
  onReset: () => void;
  showReset: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex h-full min-h-0 flex-col justify-between gap-2">
        <div
          className={cn(
            'flex min-h-0 flex-1 items-center justify-center rounded-lg border px-2 text-center font-mono text-sm leading-tight transition',
            capturing
              ? 'animate-pulse border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
              : 'border-white/10 bg-zinc-950/80 text-emerald-100/90',
          )}
        >
          {displayLabel}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => (capturing ? onCancelCapture() : onStartCapture())}
            className="rounded-md border border-white/12 bg-zinc-900/90 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800"
          >
            {capturing ? 'Cancel' : 'Rebind'}
          </button>
          {showReset ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-white/12 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-stretch justify-center gap-3 p-1">
      <div
        className={cn(
          'flex min-h-[5rem] flex-1 items-center justify-center rounded-xl border px-3 text-center font-mono text-lg leading-tight transition',
          capturing
            ? 'animate-pulse border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
            : 'border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-zinc-950/80 text-emerald-50 shadow-[inset_0_0_28px_rgba(16,185,129,0.07)]',
        )}
      >
        {displayLabel}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => (capturing ? onCancelCapture() : onStartCapture())}
          className="rounded-lg border border-white/12 bg-zinc-900/90 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-zinc-800"
        >
          {capturing ? 'Cancel' : 'Rebind'}
        </button>
        {showReset ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-white/12 bg-zinc-900/90 py-2 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          >
            Reset
          </button>
        ) : (
          <span className="rounded-lg border border-transparent py-2" aria-hidden />
        )}
      </div>
    </div>
  );
}
