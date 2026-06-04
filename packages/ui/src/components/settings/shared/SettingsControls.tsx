import { Power } from 'lucide-react';
import { cn } from '@dadei/ui/lib/shared/cn';

const segmentBase =
  'rounded-md px-3 py-2 text-sm font-medium transition emerald-glow disabled:cursor-not-allowed disabled:opacity-45';
const segmentActive = 'bg-emerald-500/15 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
const segmentIdle = 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200';

export function SegmentedShell({
  children,
  className,
  layout = 'row',
}: {
  children: React.ReactNode;
  className?: string;
  layout?: 'row' | 'grid' | 'stack';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-white/10 bg-zinc-950/50 p-1',
        layout === 'grid' && 'grid grid-cols-2 gap-1 sm:grid-cols-3',
        layout === 'stack' && 'flex flex-col gap-1',
        layout === 'row' && 'flex flex-wrap gap-1',
        className,
      )}
      role="group"
    >
      {children}
    </div>
  );
}

export function SegmentedOption({
  selected,
  onSelect,
  label,
  disabled,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(segmentBase, selected ? segmentActive : segmentIdle, className)}
    >
      {label}
    </button>
  );
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  layout = 'row',
  disabled,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  layout?: 'row' | 'grid' | 'stack';
  disabled?: boolean;
}) {
  return (
    <SegmentedShell layout={layout}>
      {options.map(opt => (
        <SegmentedOption
          key={String(opt.value)}
          selected={opt.value === value}
          disabled={disabled}
          onSelect={() => onChange(opt.value)}
          label={opt.label}
          className={layout === 'stack' ? 'w-full text-left' : undefined}
        />
      ))}
    </SegmentedShell>
  );
}

/** Many options in the same segmented visual language (scrollable grid). */
export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  maxHeightClass = 'max-h-40',
  fill = false,
  disabled,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3;
  maxHeightClass?: string;
  /** Expand to fill a grid tile with internal scroll. */
  fill?: boolean;
  disabled?: boolean;
}) {
  return (
    <SegmentedShell
      layout="grid"
      className={cn(
        columns === 3 && 'sm:grid-cols-3',
        fill ? 'h-full min-h-0 flex-1 overflow-y-auto overscroll-none' : maxHeightClass,
        !fill && 'overflow-y-auto overscroll-none',
      )}
    >
      {options.map((opt, i) => (
        <SegmentedOption
          key={opt.value ? `opt-${opt.value}` : `opt-default-${i}`}
          selected={opt.value === value}
          disabled={disabled}
          onSelect={() => onChange(opt.value)}
          label={opt.label}
          className="truncate text-left"
        />
      ))}
    </SegmentedShell>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  portrait = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  portrait?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 text-sm text-zinc-300',
        portrait ? 'flex-col items-start' : 'items-center',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative flex h-7 w-12 shrink-0 items-center rounded-full border px-0.5 transition-colors emerald-glow',
          checked ? 'border-emerald-500/50 bg-emerald-500/30' : 'border-white/10 bg-zinc-800',
        )}
      >
        <span
          className={cn(
            'relative h-5 w-5 shrink-0 rounded-full bg-zinc-100 shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
    </label>
  );
}

export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      className="h-2 w-full cursor-pointer accent-emerald-500 emerald-glow disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

/** Range slider with filled track and glow thumb. */
export function GlowSlider({
  min,
  max,
  step,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      className={cn(
        'relative flex h-10 w-full items-center rounded-lg border border-white/10 bg-zinc-950/70 px-3',
        disabled && 'opacity-45',
      )}
    >
      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600/80 via-emerald-400/90 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.45)] transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="relative z-10 h-8 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-emerald-200 [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(110,231,183,0.7)] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-200 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(110,231,183,0.7)]"
      />
    </div>
  );
}

export function NoiseSuppressionControl({
  enabled,
  level,
  onLevelChange,
}: {
  enabled: boolean;
  level: number;
  onLevelChange: (value: number) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-between gap-3">
      <p
        className={cn(
          'text-sm leading-snug transition-colors',
          enabled ? 'text-zinc-300' : 'text-zinc-600',
        )}
      >
        Reduce background hiss
      </p>
      <GlowSlider
        min={0}
        max={100}
        step={5}
        value={level}
        disabled={!enabled}
        onChange={onLevelChange}
      />
    </div>
  );
}

export function PowerToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        'rounded-lg border p-1.5 transition-colors emerald-glow',
        active
          ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
          : 'border-white/10 bg-zinc-900/80 text-zinc-500 hover:border-white/15 hover:text-zinc-400',
      )}
    >
      <Power className="h-4 w-4" />
    </button>
  );
}

export function HotkeyPicker({
  displayLabel,
  capturing,
  onStartCapture,
  onCancelCapture,
  onReset,
  showReset,
  layout = 'row',
}: {
  displayLabel: string;
  capturing: boolean;
  onStartCapture: () => void;
  onCancelCapture: () => void;
  onReset: () => void;
  showReset: boolean;
  layout?: 'row' | 'stack';
}) {
  const keyDisplay = (
    <div
      className={cn(
        'flex items-center justify-center rounded-md px-3 font-mono transition',
        layout === 'stack' ? 'min-h-[3.5rem] flex-1 text-lg' : 'min-h-[2.75rem] min-w-0 flex-1 text-base',
        capturing
          ? 'animate-pulse bg-emerald-500/20 text-emerald-200'
          : 'bg-emerald-500/10 text-emerald-100',
      )}
    >
      {displayLabel}
    </div>
  );

  if (layout === 'stack') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {keyDisplay}
        <SegmentedShell layout="row" className="w-full shrink-0">
          <SegmentedOption
            selected={capturing}
            onSelect={() => (capturing ? onCancelCapture() : onStartCapture())}
            label={capturing ? 'Cancel' : 'Rebind'}
            className="flex-1"
          />
          {showReset ? (
            <SegmentedOption selected={false} onSelect={onReset} label="Reset" className="flex-1" />
          ) : null}
        </SegmentedShell>
      </div>
    );
  }

  return (
    <SegmentedShell layout="row" className="w-full">
      {keyDisplay}
      <SegmentedOption
        selected={capturing}
        onSelect={() => (capturing ? onCancelCapture() : onStartCapture())}
        label={capturing ? 'Cancel' : 'Rebind'}
      />
      {showReset ? (
        <SegmentedOption selected={false} onSelect={onReset} label="Space" />
      ) : null}
    </SegmentedShell>
  );
}
