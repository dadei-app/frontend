import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { veilEase } from '@dadei/ui/lib/motion';
import { AUTO_FIRE_DELAY_MS } from '@dadei/ui/lib/notificationConstants';
import type { NetworkAction } from '@dadei/ui/types/models.types';
import { actionsApi } from '@dadei/ui/lib/api/actions';

const ACTION_LABELS: Record<string, string> = {
  calendar_event: 'Calendar event',
  task: 'Task',
  reminder: 'Reminder',
  email: 'Email',
};

export function ProposedActionBanner({
  action,
  onResolved,
}: {
  action: NetworkAction;
  onResolved: (action: NetworkAction) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = ACTION_LABELS[action.action_type] ?? action.action_type;
  const title = action.title?.trim() || label;
  const meta = useMemo(() => buildMeta(action), [action]);

  const handleReject = async () => {
    setRejecting(true);
    setError(null);
    try {
      const updated = await actionsApi.reject(action.id);
      onResolved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel');
      setRejecting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.985 }}
      transition={{ duration: 0.36, ease: veilEase }}
      className="
        group relative w-full overflow-hidden
        rounded-2xl border border-white/[0.06]
        bg-zinc-950/95 backdrop-blur-2xl
        shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.7)]
        transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
        hover:-translate-y-px hover:border-white/[0.10]
        hover:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_28px_70px_-20px_rgba(0,0,0,0.78)]
      "
    >
      {/* Top accent line — a subtle hairline separating the countdown */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />

      {/* Countdown bar */}
      {action.scheduled_at ? <CountdownBar scheduledAt={action.scheduled_at} /> : null}

      <div className="flex items-center gap-4 px-4 py-3.5 pt-4">
        {/* Left: ~80% — type label, title, metadata */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500/90 font-secondary">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold leading-snug text-zinc-100">
            {title}
          </p>
          {meta ? (
            <p className="mt-0.5 truncate text-xs leading-relaxed text-zinc-400/90 font-secondary">
              {meta}
            </p>
          ) : null}
          {error ? (
            <p className="mt-1 text-xs text-red-400/90 font-secondary">{error}</p>
          ) : null}
        </div>

        {/* Right: ~20% — single Cancel button, vertically centered */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleReject}
            disabled={rejecting}
            className="
              rounded-md px-3 py-1.5
              text-xs font-medium text-zinc-400
              transition duration-200
              hover:bg-white/[0.04] hover:text-zinc-100
              disabled:opacity-50
              focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20
            "
          >
            {rejecting ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CountdownBar({ scheduledAt }: { scheduledAt: string }) {
  // Compute the bar's starting position so a late mount (network delay,
  // realtime hop) doesn't make the bar look behind.
  const { initialScaleX, remainingSec } = useMemo(() => {
    const targetMs = new Date(scheduledAt).getTime();
    const remainingMs = Math.max(targetMs - Date.now(), 0);
    const elapsed = Math.max(AUTO_FIRE_DELAY_MS - remainingMs, 0);
    return {
      initialScaleX: Math.min(elapsed / AUTO_FIRE_DELAY_MS, 1),
      remainingSec: remainingMs / 1000,
    };
  }, [scheduledAt]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden">
      <motion.div
        initial={{ scaleX: initialScaleX, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: remainingSec, ease: 'linear' }}
        className="
          h-full origin-left
          bg-gradient-to-r from-zinc-500/40 via-zinc-200/80 to-zinc-100
        "
        style={{ boxShadow: '0 0 10px rgba(255,255,255,0.18)' }}
      />
    </div>
  );
}

function buildMeta(action: NetworkAction): string | undefined {
  const parts: string[] = [];
  if (action.start_time) {
    parts.push(formatDateTime(action.start_time));
  }
  // Pull a short snippet from the proposed details for email body / event description
  if (action.details) {
    try {
      const parsed = JSON.parse(action.details) as {
        tool_args?: { description?: string; body?: string; notes?: string; to?: string };
      };
      const detail =
        parsed.tool_args?.description ||
        parsed.tool_args?.body ||
        parsed.tool_args?.notes ||
        parsed.tool_args?.to;
      if (detail) {
        parts.push(truncate(detail, 80));
      }
    } catch {
      /* details not JSON, ignore */
    }
  }
  return parts.length ? parts.join(' · ') : undefined;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}
