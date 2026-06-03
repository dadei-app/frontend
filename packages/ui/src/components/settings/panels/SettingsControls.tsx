import { cn } from '@dadei/ui/lib/shared/cn';

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-300">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full border transition-colors emerald-glow',
          checked ? 'border-emerald-500/50 bg-emerald-500/30' : 'border-white/10 bg-zinc-800',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-zinc-100 shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
      <span>{label}</span>
    </label>
  );
}

export function Slider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="h-2 w-full cursor-pointer accent-emerald-500 emerald-glow"
    />
  );
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-zinc-950/50 p-1">
      {options.map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition emerald-glow',
            value === opt.value
              ? 'bg-emerald-500/15 text-emerald-200'
              : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
