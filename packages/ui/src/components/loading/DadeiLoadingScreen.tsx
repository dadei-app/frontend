import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';
import { useBootstrap } from '@dadei/ui/contexts/BootstrapContext';
import type { BootstrapPhase } from '@dadei/ui/types/electron';
import { cn } from '@dadei/ui/lib/shared/cn';

const PHASE_LABELS: Record<BootstrapPhase, string> = {
  booting: 'Starting Dadei…',
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

export function DadeiLoadingScreen({ subtitleOverride }: { subtitleOverride?: string }) {
  const { state, isReady } = useBootstrap();
  const { phase, progress, message, downloadUrl } = state;

  const subtitle = useMemo(
    () => statusText(phase, progress, message, subtitleOverride),
    [phase, progress, message, subtitleOverride],
  );

  const showProgress = phase === 'downloading';
  const showManualCta =
    (phase === 'manual_required' || phase === 'mandatory_failed') && !!downloadUrl;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      animate={{ opacity: isReady ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      aria-busy={!isReady}
      aria-live="polite"
    >
      {/* Dot matrix with inverse radial mask */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage:
            'radial-gradient(circle at center, transparent 0%, transparent 18%, black 50%, black 100%)',
          maskImage:
            'radial-gradient(circle at center, transparent 0%, transparent 18%, black 50%, black 100%)',
        }}
        aria-hidden
      >
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dadei-dot-matrix" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.5" fill="rgba(16,185,129,0.18)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dadei-dot-matrix)" />
        </svg>
      </div>

      {/* Pulsating ripples */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        {[0, 0.8, 1.6].map((delay) => (
          <motion.svg
            key={delay}
            className="absolute h-48 w-48"
            viewBox="0 0 200 200"
            initial={{ scale: 0.6, opacity: 0.8 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: 'easeOut',
              delay,
            }}
          >
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
            />
          </motion.svg>
        ))}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <Mic className="mb-4 h-12 w-12 text-emerald-50" strokeWidth={1.5} aria-hidden />
        <h1 className="font-brand text-4xl tracking-wider text-emerald-50">Dadei</h1>

        {subtitle ? (
          <motion.p
            key={subtitle}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-w-md text-center text-sm text-zinc-400 font-secondary"
          >
            {subtitle}
          </motion.p>
        ) : null}

        {showProgress ? (
          <div className="mt-6 h-0.5 w-48 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress ?? 0))}%` }}
              transition={{ duration: 0.15 }}
            />
          </div>
        ) : null}

        {showManualCta ? (
          <button
            type="button"
            onClick={() => openDownloadUrl(downloadUrl!)}
            className={cn(
              'mt-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200',
              'hover:bg-emerald-500/20 transition-colors',
            )}
          >
            Download new version
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
