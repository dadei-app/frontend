import { cn } from '@dadei/ui/lib/platform/shared/cn';

export function AssistantHotkeyControl({
  displayLabel,
  capturing,
  onPressDisplay,
  compact = false,
}: {
  displayLabel: string;
  capturing: boolean;
  /** Click the key display to start listening; click again while capturing to cancel. */
  onPressDisplay: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPressDisplay}
      className={cn(
        'assistant-hotkey-btn flex w-full min-w-0 flex-col overflow-hidden rounded-lg border text-center font-mono transition emerald-glow',
        compact
          ? 'h-full min-h-0 flex-1 items-center justify-center px-2 text-sm leading-tight'
          : 'min-h-[5rem] flex-1 items-center justify-center px-3 text-lg leading-tight',
        capturing
          ? 'animate-pulse border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
          : compact
            ? 'border-white/10 bg-zinc-950/80 text-emerald-100/90 hover:border-white/15 hover:bg-zinc-900/90'
            : 'border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-zinc-950/80 text-emerald-50 shadow-[inset_0_0_28px_rgba(16,185,129,0.07)] hover:border-emerald-500/35',
      )}
    >
      {displayLabel}
    </button>
  );
}
