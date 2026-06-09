import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import type { BootstrapPhase } from '@dadei/ui/types/electron';
import { cn } from '@dadei/ui/lib/shared/cn';

const PHASE_LABELS: Record<BootstrapPhase, string> = {
  booting: 'Starting dadei…',
  checking_server: 'Connecting to backend…',
  checking_updates: 'Checking for updates…',
  downloading: 'Downloading update…',
  install_pending: 'Install ready. Restart to apply.',
  manual_required: 'A new version is available.',
  mandatory_failed: 'Could not find a compatible update.',
  ready: '',
};

function statusText(
  phase: BootstrapPhase,
  progress?: number,
  message?: string,
  subtitleOverride?: string,
): string {
  if (subtitleOverride) return subtitleOverride;
  if (message) return message;
  if (phase === 'downloading' && progress != null) {
    return `${PHASE_LABELS.downloading} ${Math.round(progress)}%`;
  }
  return PHASE_LABELS[phase] ?? '';
}

function openDownloadUrl(url: string) {
  if (window.electronAPI?.openExternal) {
    void window.electronAPI.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Idle "breathing" waveform — center-weighted bar heights, desynced loops. */
const BARS = [
  { height: 12, keyframes: [0.45, 0.9, 0.5, 1, 0.45], duration: 1.5 },
  { height: 22, keyframes: [0.6, 0.35, 1, 0.55, 0.6], duration: 1.8 },
  { height: 32, keyframes: [0.5, 1, 0.45, 0.85, 0.5], duration: 1.4 },
  { height: 22, keyframes: [1, 0.5, 0.8, 0.4, 1], duration: 1.9 },
  { height: 12, keyframes: [0.5, 0.85, 0.45, 1, 0.5], duration: 1.6 },
];

const WORDMARK = 'dadei'.split('');

export function LoadingScreen({ subtitleOverride }: { subtitleOverride?: string }) {
  const { bootstrapState, isBootstrapReady, isElectron } = useSystem();
  const { phase, progress, message, downloadUrl } = bootstrapState;
  const reduceMotion = useReducedMotion();

  const subtitle = useMemo(
    () => statusText(phase, progress, message, subtitleOverride),
    [phase, progress, message, subtitleOverride],
  );

  const showProgress = phase === 'downloading';
  const showManualCta =
    (phase === 'manual_required' || phase === 'mandatory_failed') && !!downloadUrl;

  return (
    <motion.div
      className={cn(
        'z-50 flex flex-col bg-zinc-950',
        isElectron ? 'absolute inset-0' : 'fixed inset-0',
      )}
      animate={{ opacity: isBootstrapReady ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      aria-busy={!isBootstrapReady}
      aria-live="polite"
    >
      {/* Ambient emerald wash, breathing slowly behind everything */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 50% at 50% 42%, rgba(16,185,129,0.09), transparent 70%)',
        }}
        animate={reduceMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      {/* Dot matrix with inverse radial mask */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage:
            'radial-gradient(circle at center, transparent 0%, transparent 22%, black 55%, black 100%)',
          maskImage:
            'radial-gradient(circle at center, transparent 0%, transparent 22%, black 55%, black 100%)',
        }}
        aria-hidden
      >
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dadei-dot-matrix" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1" fill="rgba(16,185,129,0.14)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dadei-dot-matrix)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        {/* Holographic ring with live waveform core */}
        <motion.div
          className="relative mb-10 flex h-40 w-40 items-center justify-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {/* Soft core glow */}
          <div
            className="absolute inset-5 rounded-full bg-emerald-500/15 blur-2xl"
            aria-hidden
          />

          {/* Static hairline ring */}
          <div
            className="absolute inset-0 rounded-full border border-emerald-400/15"
            aria-hidden
          />

          {/* Rotating holographic arc */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0%, rgba(16,185,129,0.05) 8%, rgba(52,211,153,0.9) 18%, rgba(16,185,129,0.05) 30%, transparent 38%, transparent 100%)',
              WebkitMaskImage:
                'radial-gradient(circle, transparent 0%, transparent 65%, black 67%, black 100%)',
              maskImage:
                'radial-gradient(circle, transparent 0%, transparent 65%, black 67%, black 100%)',
            }}
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
            aria-hidden
          />

          {/* Inner glass disc */}
          <div
            className="absolute inset-3 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-sm"
            aria-hidden
          />

          {/* Breathing waveform */}
          <div className="relative flex h-10 items-center gap-1.5" aria-hidden>
            {BARS.map((bar, i) => (
              <motion.span
                key={i}
                className="w-1 origin-center rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.45)]"
                style={{ height: bar.height }}
                animate={reduceMotion ? undefined : { scaleY: bar.keyframes }}
                transition={{
                  duration: bar.duration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Wordmark, letters cascading in */}
        <h1 className="font-brand text-4xl tracking-[0.3em] text-emerald-50 [margin-right:-0.3em]">
          {WORDMARK.map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.25 + i * 0.07, duration: 0.55, ease: 'easeOut' }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>

        {subtitle ? (
          <motion.p
            key={subtitle}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="font-secondary mt-7 max-w-md text-center text-sm tracking-wide text-zinc-400"
          >
            {subtitle}
          </motion.p>
        ) : null}

        {showProgress ? (
          <div className="mt-7 h-1 w-56 overflow-hidden rounded-full border border-white/10 bg-white/5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.55)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress ?? 0))}%` }}
              transition={{ duration: 0.15 }}
            />
          </div>
        ) : null}

        {showManualCta ? (
          <motion.button
            type="button"
            onClick={() => openDownloadUrl(downloadUrl!)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={cn(
              'font-secondary mt-8 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-5 py-2.5 text-sm text-emerald-100 backdrop-blur-md',
              'shadow-[0_0_24px_rgba(16,185,129,0.12)] transition-all',
              'hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:shadow-[0_0_32px_rgba(16,185,129,0.22)]',
            )}
          >
            Download new version
          </motion.button>
        ) : null}
      </div>
    </motion.div>
  );
}