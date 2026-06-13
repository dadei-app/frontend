import { parseApiDateTimeMs } from '@dadei/ui/lib/shared/parseApiDateTime';

export type ApprovalCountdownProgress = {
  initialScaleX: number;
  remainingMs: number;
  remainingSec: number;
};

/**
 * Progress for the action-approval banner countdown.
 *
 * ``windowMs`` is the full approval window (e.g. 10s). ``countdownEndsAt`` is the
 * UTC instant when auto-fire runs (``scheduled_at`` from the API).
 */
export function computeApprovalCountdown(
  countdownEndsAt: string | undefined,
  windowMs: number,
  nowMs: number = Date.now(),
): ApprovalCountdownProgress {
  const windowMsSafe = Math.max(windowMs, 1);
  const fallbackEndMs = nowMs + windowMsSafe;
  const endMs = countdownEndsAt ? parseApiDateTimeMs(countdownEndsAt) : fallbackEndMs;

  if (!Number.isFinite(endMs)) {
    return { initialScaleX: 0, remainingMs: 0, remainingSec: 0 };
  }

  const remainingMs = Math.max(endMs - nowMs, 0);
  const initialScaleX = Math.min(remainingMs / windowMsSafe, 1);

  return {
    initialScaleX,
    remainingMs,
    remainingSec: remainingMs / 1000,
  };
}
