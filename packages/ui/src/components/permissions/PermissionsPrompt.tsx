import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import {
  isRequiredPermission,
  permissionsForPlatform,
  toTutorialPlatform,
  type PermissionEntry,
} from '@dadei/ui/lib/onboarding/tutorial/permissionsRegistry';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

type PermissionUiStatus = 'idle' | 'pending' | 'granted' | 'denied';

const ROW_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const GRANT_POLL_MS = 200;
const GRANT_POLL_MAX_MS = 8_000;

async function pollUntilGranted(
  entry: PermissionEntry,
  signal: AbortSignal,
): Promise<boolean> {
  const started = Date.now();
  while (!signal.aborted && Date.now() - started < GRANT_POLL_MAX_MS) {
    const result = await entry.check();
    if (result === 'granted') return true;
    await new Promise(resolve => window.setTimeout(resolve, GRANT_POLL_MS));
  }
  return false;
}

function resolveUiStatus(
  requestResult: 'granted' | 'denied',
  checkResult: 'granted' | 'denied' | 'unknown',
): PermissionUiStatus {
  if (requestResult === 'granted' || checkResult === 'granted') return 'granted';
  if (checkResult === 'denied') return 'denied';
  return 'denied';
}

export function PermissionsPrompt({
  onRequiredGrantedChange,
  onAllGrantedChange,
}: {
  onRequiredGrantedChange: (granted: boolean) => void;
  onAllGrantedChange?: (granted: boolean) => void;
}) {
  const { isElectron, platform } = useSystem();
  const reduceMotion = useReducedMotion();
  const tutorialPlatform = toTutorialPlatform(platform, isElectron);
  const entries = useMemo(
    () => permissionsForPlatform(tutorialPlatform, isElectron),
    [tutorialPlatform, isElectron],
  );
  const [statusById, setStatusById] = useState<Record<string, PermissionUiStatus>>({});
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, PermissionUiStatus> = {};
      await Promise.all(
        entries.map(async entry => {
          const result = await entry.check();
          if (result === 'granted') next[entry.id] = 'granted';
          else if (result === 'denied') next[entry.id] = 'denied';
        }),
      );
      if (!cancelled) {
        setStatusById(prev => ({ ...next, ...prev }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const requiredGranted = entries
    .filter(isRequiredPermission)
    .every(entry => statusById[entry.id] === 'granted');

  const allGranted =
    entries.length > 0 &&
    entries.every(entry => statusById[entry.id] === 'granted');

  useEffect(() => {
    onRequiredGrantedChange(requiredGranted);
  }, [requiredGranted, onRequiredGrantedChange]);

  useEffect(() => {
    onAllGrantedChange?.(allGranted);
  }, [allGranted, onAllGrantedChange]);

  const handleAllow = useCallback(async (entry: PermissionEntry) => {
    pollAbortRef.current?.abort();
    const pollAbort = new AbortController();
    pollAbortRef.current = pollAbort;

    setStatusById(prev => ({ ...prev, [entry.id]: 'pending' }));

    const pollGranted = pollUntilGranted(entry, pollAbort.signal).then(granted => {
      if (granted && !pollAbort.signal.aborted) {
        setStatusById(prev => ({ ...prev, [entry.id]: 'granted' }));
      }
      return granted;
    });

    const requestResult = await entry.request();
    if (pollAbort.signal.aborted) return;

    if (requestResult === 'granted') {
      pollAbort.abort();
      setStatusById(prev => ({ ...prev, [entry.id]: 'granted' }));
      return;
    }

    const polledGranted = await pollGranted;
    if (pollAbort.signal.aborted || polledGranted) return;

    const recheck = await entry.check();
    setStatusById(prev => ({
      ...prev,
      [entry.id]: resolveUiStatus(requestResult, recheck),
    }));
  }, []);

  const grantedCount = entries.filter(entry => statusById[entry.id] === 'granted').length;
  const progress = entries.length > 0 ? grantedCount / entries.length : 0;

  return (
    <div>
      <p className="text-sm leading-snug text-zinc-400 font-secondary">
        Microphone is required before the assistant can listen on this device. Other permissions
        improve weather, location, and desktop actions — you can skip those once the mic is allowed.
      </p>

      {entries.length > 0 ? (
        <div className="mt-2.5">
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500 font-secondary">
            <span>
              {grantedCount} of {entries.length} allowed
            </span>
            {allGranted ? (
              <motion.span
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="whitespace-nowrap text-emerald-400/90"
              >
                All set
              </motion.span>
            ) : requiredGranted ? (
              <motion.span
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="whitespace-nowrap text-emerald-400/90"
              >
                Mic ready
              </motion.span>
            ) : null}
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800/90">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.45, ease: 'easeOut' }}
            />
          </div>
        </div>
      ) : null}

      <motion.ul
        className="mt-3 space-y-2"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: reduceMotion
              ? { duration: 0 }
              : { staggerChildren: 0.07, delayChildren: 0.05 },
          },
        }}
      >
        {entries.map(entry => {
          const status = statusById[entry.id] ?? 'idle';
          const required = isRequiredPermission(entry);
          const label =
            status === 'pending'
              ? 'Requesting…'
              : status === 'granted'
                ? 'Allowed'
                : status === 'denied'
                  ? 'Try again'
                  : 'Allow';

          return (
            <motion.li
              key={entry.id}
              variants={ROW_VARIANTS}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
              layout
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border p-3',
                status === 'granted'
                  ? 'border-emerald-500/25 bg-emerald-950/20'
                  : 'border-white/10 bg-zinc-900/55',
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-zinc-100">{entry.label}</p>
                  {required ? (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/95">
                      Required
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs leading-snug text-zinc-500 font-secondary">
                  {entry.description}
                </p>
              </div>
              <motion.button
                type="button"
                disabled={status === 'pending' || status === 'granted'}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                  status === 'granted' &&
                    'cursor-default border-emerald-500/20 bg-emerald-950/40 text-emerald-300/80',
                  status === 'pending' &&
                    'cursor-wait border-white/10 bg-zinc-800/60 text-zinc-500',
                  (status === 'idle' || status === 'denied') &&
                    'border-emerald-500/35 bg-emerald-950/45 text-emerald-100 hover:bg-emerald-900/55',
                )}
                whileTap={
                  status === 'idle' || status === 'denied'
                    ? { scale: reduceMotion ? 1 : 0.97 }
                    : undefined
                }
                onClick={() => {
                  void handleAllow(entry);
                }}
              >
                {label}
              </motion.button>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
