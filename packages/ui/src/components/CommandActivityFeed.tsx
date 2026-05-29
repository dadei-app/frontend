import type { CommandActivityStep } from '@dadei/ui/contexts/CommandContext';

function StepIcon({ status }: { status: CommandActivityStep['status'] }) {
  if (status === 'running') {
    return (
      <span
        className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300/90"
        aria-hidden
      />
    );
  }
  if (status === 'done') {
    return (
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-emerald-400/90" aria-hidden>
        ✓
      </span>
    );
  }
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-red-400/90" aria-hidden>
      ✕
    </span>
  );
}

interface CommandActivityFeedProps {
  steps: CommandActivityStep[];
  compact?: boolean;
}

export default function CommandActivityFeed({ steps, compact = false }: CommandActivityFeedProps) {
  if (steps.length === 0) return null;

  return (
    <ul
      className={compact ? 'mt-2 space-y-1' : 'mt-1.5 space-y-1.5'}
      aria-live="polite"
      aria-label="Assistant progress"
    >
      {steps.map((step) => (
        <li
          key={step.id}
          className={`flex items-start gap-2.5 ${
            step.status === 'running' ? 'text-zinc-100/95' : 'text-zinc-400'
          }`}
        >
          <StepIcon status={step.status} />
          <span className={`font-primary leading-snug ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
            {step.label}
            {step.detail && step.status !== 'running' ? (
              <span className="text-zinc-500"> — {step.detail}</span>
            ) : null}
            {step.status === 'running' ? (
              <span className="ml-0.5 inline-block animate-pulse text-zinc-500">…</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
