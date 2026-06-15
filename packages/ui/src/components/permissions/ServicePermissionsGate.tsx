import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { PermissionsPrompt } from '@dadei/ui/components/permissions/PermissionsPrompt';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

const CARD_SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.85 };

const CONFIRM_KNOB_CLASS =
  'flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-950/70 text-emerald-200 shadow-sm shadow-emerald-950/40 transition hover:border-emerald-300/50 hover:bg-emerald-900/60 hover:text-emerald-100 disabled:pointer-events-none disabled:opacity-30';

const AUTO_DISMISS_MS = 480;

export function ServicePermissionsGate() {
  const {
    permissionsGateOpen,
    permissionsGateIntent,
    completePermissionsGate,
  } = useService();
  const reduceMotion = useReducedMotion();
  const [requiredGranted, setRequiredGranted] = useState(false);
  const [allGranted, setAllGranted] = useState(false);
  const completingRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completingRef.current || !requiredGranted) return;
    completingRef.current = true;
    void completePermissionsGate();
  }, [completePermissionsGate, requiredGranted]);

  useEffect(() => {
    if (!permissionsGateOpen) {
      setRequiredGranted(false);
      setAllGranted(false);
      completingRef.current = false;
    }
  }, [permissionsGateOpen]);

  useEffect(() => {
    if (!allGranted || completingRef.current) return;
    const delay = reduceMotion ? 0 : AUTO_DISMISS_MS;
    const id = window.setTimeout(() => {
      handleComplete();
    }, delay);
    return () => window.clearTimeout(id);
  }, [allGranted, handleComplete, reduceMotion]);

  const title =
    permissionsGateIntent === 'enable' ? 'Turn on listening' : 'Permissions needed';
  const subtitle =
    permissionsGateIntent === 'enable'
      ? 'Allow microphone access to enable the assistant on this device.'
      : 'Grant access on this device before the assistant can listen.';

  return (
    <AnimatePresence>
      {permissionsGateOpen && permissionsGateIntent ? (
        <motion.div
          key="permissions-gate"
          className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center px-4 sm:px-6 lg:px-10"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-zinc-950/88"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.28 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="permissions-gate-title"
            className={cn(
              'relative z-10 w-full max-w-[26rem] min-w-[18rem]',
              'overflow-hidden rounded-2xl border border-white/10',
              'bg-zinc-950 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)]',
            )}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 18, scale: 0.94, filter: 'blur(6px)' }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10, scale: 0.97, filter: 'blur(4px)' }
            }
            transition={reduceMotion ? { duration: 0.15 } : CARD_SPRING}
          >
            <div className="relative border-b border-white/8 px-5 py-3.5">
              <div className="absolute top-4 right-4 z-10">
                <motion.button
                  type="button"
                  className={CONFIRM_KNOB_CLASS}
                  aria-label={
                    permissionsGateIntent === 'enable'
                      ? 'Turn on listening'
                      : 'Continue with permissions'
                  }
                  disabled={!requiredGranted}
                  animate={
                    requiredGranted && !reduceMotion
                      ? {
                          boxShadow: [
                            '0 0 0 rgba(16,185,129,0)',
                            '0 0 14px rgba(16,185,129,0.35)',
                            '0 0 0 rgba(16,185,129,0)',
                          ],
                        }
                      : { boxShadow: '0 0 0 rgba(16,185,129,0)' }
                  }
                  transition={
                    requiredGranted && !reduceMotion
                      ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.2 }
                  }
                  onClick={handleComplete}
                >
                  <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
                </motion.button>
              </div>

              <h2
                id="permissions-gate-title"
                className="pr-10 font-primary text-lg font-semibold leading-snug text-zinc-50"
              >
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400 font-secondary">
                {subtitle}
              </p>
            </div>

            <div className="px-5 py-3.5">
              <PermissionsPrompt
                key={permissionsGateIntent ?? 'closed'}
                onRequiredGrantedChange={setRequiredGranted}
                onAllGrantedChange={setAllGranted}
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

