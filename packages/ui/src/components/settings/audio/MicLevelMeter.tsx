import { clampMicLevel } from '@dadei/ui/contexts/AudioContext';
import { cn } from '@dadei/ui/lib/shared/cn';

const SEGMENTS = 40;
const ZONES = [
  { id: 'low', label: 'Low', max: 1 / 3 },
  { id: 'medium', label: 'Medium', max: 2 / 3 },
  { id: 'high', label: 'High', max: 1 },
] as const;

function activeZone(level: number): (typeof ZONES)[number]['id'] {
  if (level < ZONES[0].max) return 'low';
  if (level < ZONES[1].max) return 'medium';
  return 'high';
}

export function MicLevelMeter({ level }: { level: number }) {
  const clamped = clampMicLevel(level);
  const active = Math.min(SEGMENTS, Math.max(0, Math.round(clamped * SEGMENTS)));
  const zone = activeZone(clamped);

  return (
    <div className="mic-level-meter flex h-full min-h-0 flex-col justify-center gap-5 px-1 py-2">
      <div
        className="mic-level-meter__bars flex h-[7.5rem] w-full items-end justify-center gap-[2px] rounded-xl border border-white/8 bg-zinc-950/70 px-3 py-4"
        role="meter"
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Microphone input level"
      >
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const on = i < active;
          const t = i / SEGMENTS;
          const hPct = 22 + t * 78;
          return (
            <div
              key={i}
              className={cn(
                'mic-level-meter__bar w-1.5 max-w-[10px] flex-1 rounded-sm transition-all duration-75',
                on
                  ? t > 0.85
                    ? 'bg-emerald-200 shadow-[0_0_10px_rgba(167,243,208,0.5)]'
                    : t > 0.5
                      ? 'bg-emerald-400/95'
                      : 'bg-emerald-600/85'
                  : 'bg-white/[0.06]',
              )}
              style={{ height: `${hPct}%` }}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-white/8 pt-3">
        {ZONES.map(z => {
          const isActive = zone === z.id;
          return (
            <div
              key={z.id}
              className={cn(
                'rounded-lg border px-2 py-2 text-center transition-colors',
                isActive
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-transparent bg-transparent',
              )}
            >
              <p
                className={cn(
                  'text-[11px] font-medium uppercase tracking-wide',
                  isActive ? 'text-emerald-200' : 'text-zinc-600',
                )}
              >
                {z.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
