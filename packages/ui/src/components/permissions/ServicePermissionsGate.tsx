import { useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { PermissionsPrompt } from '@dadei/ui/components/permissions/PermissionsPrompt';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

export function ServicePermissionsGate() {
  const {
    permissionsGateOpen,
    permissionsGateIntent,
    completePermissionsGate,
    dismissPermissionsGate,
  } = useService();
  const reduceMotion = useReducedMotion();
  const [requiredGranted, setRequiredGranted] = useState(false);

  const handleContinue = useCallback(() => {
    if (!requiredGranted) return;
    void completePermissionsGate();
  }, [completePermissionsGate, requiredGranted]);

  if (!permissionsGateOpen || !permissionsGateIntent) return null;

  const title =
    permissionsGateIntent === 'enable'
      ? 'Enable the assistant'
      : 'Microphone access needed';
  const subtitle =
    permissionsGateIntent === 'enable'
      ? 'Grant microphone access to turn on listening.'
      : 'This device needs microphone access before the assistant can listen.';

  return (
    <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        onClick={dismissPermissionsGate}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="permissions-gate-title"
        className={cn(
          'relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-200/60',
          'bg-zinc-950/95 shadow-[0_0_0_1px_rgba(167,243,208,0.3)_inset,0_18px_50px_-18px_rgba(16,185,129,0.45)]',
          'backdrop-blur-xl',
        )}
        initial={false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
      >
        <div className="p-5">
          <h2
            id="permissions-gate-title"
            className="font-primary text-lg font-semibold leading-tight text-zinc-50"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300 font-secondary">{subtitle}</p>
          <div className="mt-4">
            <PermissionsPrompt
              key={permissionsGateIntent ?? 'closed'}
              onRequiredGrantedChange={setRequiredGranted}
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
              onClick={dismissPermissionsGate}
            >
              Not now
            </button>
            <button
              type="button"
              disabled={!requiredGranted}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm transition',
                requiredGranted
                  ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-100 hover:bg-emerald-900/50'
                  : 'cursor-not-allowed border-white/8 bg-zinc-900/60 text-zinc-600',
              )}
              onClick={handleContinue}
            >
              {permissionsGateIntent === 'enable' ? 'Turn on' : 'Continue'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
