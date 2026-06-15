import { describe, expect, it } from 'vitest';

import { computeApprovalCountdown } from '@dadei/ui/lib/assistant/notifications/approvalCountdown';
import { AUTO_FIRE_DELAY_MS } from '@dadei/ui/lib/assistant/notifications/constants';

describe('computeApprovalCountdown', () => {
  it('uses full window when countdown ends in 10s', () => {
    const now = Date.parse('2026-06-02T02:52:13.000Z');
    const endsAt = '2026-06-02T02:52:23.052034Z';
    const { remainingMs, remainingSec } = computeApprovalCountdown(
      endsAt,
      AUTO_FIRE_DELAY_MS,
      now,
    );
    expect(remainingMs).toBeCloseTo(10_052, -1);
    expect(remainingSec).toBeCloseTo(10.052, 2);
  });

  it('reflects late banner delivery in remaining time', () => {
    const now = Date.parse('2026-06-02T02:52:18.000Z');
    const endsAt = '2026-06-02T02:52:23.000Z';
    const { remainingMs } = computeApprovalCountdown(
      endsAt,
      AUTO_FIRE_DELAY_MS,
      now,
    );
    expect(remainingMs).toBe(5000);
  });

  it('does not cap remaining time to the auto-fire window', () => {
    const now = Date.parse('2026-06-02T02:52:13.000Z');
    const endsAt = '2026-06-02T06:52:23.000Z';
    const { remainingSec } = computeApprovalCountdown(
      endsAt,
      AUTO_FIRE_DELAY_MS,
      now,
    );
    expect(remainingSec).toBeGreaterThan(10_000);
  });

  it('handles invalid timestamps', () => {
    const result = computeApprovalCountdown('not-a-date', AUTO_FIRE_DELAY_MS, 0);
    expect(result.remainingMs).toBe(0);
  });
});
