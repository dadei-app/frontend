import { describe, expect, it } from 'vitest';

import { computeApprovalCountdown } from './approvalCountdown';
import { AUTO_FIRE_DELAY_MS } from './constants';

describe('computeApprovalCountdown', () => {
  it('uses full window when countdown ends in 10s', () => {
    const now = Date.parse('2026-06-02T02:52:13.000Z');
    const endsAt = '2026-06-02T02:52:23.052034Z';
    const { initialScaleX, remainingMs, remainingSec } = computeApprovalCountdown(
      endsAt,
      AUTO_FIRE_DELAY_MS,
      now,
    );
    expect(remainingMs).toBeCloseTo(10_052, -1);
    expect(initialScaleX).toBeCloseTo(1, 2);
    expect(remainingSec).toBeCloseTo(10.052, 2);
  });

  it('shrinks initial scale when the client receives the banner late', () => {
    const now = Date.parse('2026-06-02T02:52:18.000Z');
    const endsAt = '2026-06-02T02:52:23.000Z';
    const { initialScaleX, remainingMs } = computeApprovalCountdown(
      endsAt,
      AUTO_FIRE_DELAY_MS,
      now,
    );
    expect(remainingMs).toBe(5000);
    expect(initialScaleX).toBeCloseTo(0.5, 3);
  });

  it('does not stretch animation when remaining time exceeds the window', () => {
    const now = Date.parse('2026-06-02T02:52:13.000Z');
    const endsAt = '2026-06-02T06:52:23.000Z';
    const { initialScaleX, remainingSec } = computeApprovalCountdown(
      endsAt,
      AUTO_FIRE_DELAY_MS,
      now,
    );
    expect(initialScaleX).toBe(1);
    expect(remainingSec).toBeGreaterThan(10_000);
  });

  it('handles invalid timestamps', () => {
    const result = computeApprovalCountdown('not-a-date', AUTO_FIRE_DELAY_MS, 0);
    expect(result.remainingMs).toBe(0);
    expect(result.initialScaleX).toBe(0);
  });
});
