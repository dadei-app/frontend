import { motion } from 'framer-motion';
import { useState } from 'react';
import { veilEase } from '@dadei/ui/lib/motion';
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
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = ACTION_LABELS[action.action_type] ?? action.action_type;
  const title = action.title?.trim() || label;
  const body = extractBody(action);

  const handle = async (kind: 'accept' | 'reject') => {
    setBusy(kind);
    setError(null);
    try {
      const updated = kind === 'accept'
        ? await actionsApi.accept(action.id)
        : await actionsApi.reject(action.id);
      onResolved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(null);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.32, ease: veilEase }}
      className="group relative w-full overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-950/90 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_10px_32px_-12px_rgba(0,0,0,0.65)] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-white/10"
    >
      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 font-secondary">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-zinc-100">{title}</p>
          {body ? (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-400 font-secondary">{body}</p>
          ) : null}
        </div>

        {error ? (
          <p className="text-xs text-red-400/90 font-secondary">{error}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handle('reject')}
            disabled={busy !== null}
            className="text-xs font-medium px-3 py-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => handle('accept')}
            disabled={busy !== null}
            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[#F5E8CD] text-zinc-950 hover:bg-[#EFD9A8] transition disabled:opacity-60"
          >
            {busy === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function extractBody(action: NetworkAction): string | undefined {
  if (!action.details) return undefined;
  try {
    const parsed = JSON.parse(action.details) as { tool_args?: { description?: string; body?: string; notes?: string } };
    return (
      parsed.tool_args?.description ||
      parsed.tool_args?.body ||
      parsed.tool_args?.notes ||
      undefined
    );
  } catch {
    return undefined;
  }
}
