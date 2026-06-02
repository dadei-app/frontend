/**
 * Plays a short, soft two-tone ding using Web Audio API.
 * No asset files. Tones tuned to be present-but-unobtrusive.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  durationMs: number,
  peakGain = 0.07
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const start = startAt;
  const attackEnd = start + 0.008;
  const sustainEnd = start + durationMs / 1000;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, attackEnd);
  gain.gain.exponentialRampToValueAtTime(0.0001, sustainEnd);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(sustainEnd + 0.02);
}

export function playNotificationPing(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 880, now, 120);
  tone(ctx, 1318.5, now + 0.08, 160);
}
