import { Mic } from 'lucide-react';
import { cn } from '@dadei/ui/lib/shared/cn';

export function MicDeviceList<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-none pr-0.5">
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <li key={opt.value ? `mic-${opt.value}` : `mic-default-${i}`}>
            <button
              type="button"
              disabled={disabled}
              title={opt.label}
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition',
                selected
                  ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-100 shadow-[inset_0_0_20px_rgba(16,185,129,0.06)]'
                  : 'border-white/8 bg-zinc-950/50 text-zinc-400 hover:border-white/14 hover:bg-zinc-900/80 hover:text-zinc-200',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <Mic
                className={cn(
                  'h-4 w-4 shrink-0',
                  selected ? 'text-emerald-400' : 'text-zinc-600',
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate leading-snug">{opt.label}</span>
              {selected ? (
                <span className="ml-2 shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-400/90">
                  Active
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
