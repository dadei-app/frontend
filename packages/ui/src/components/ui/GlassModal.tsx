import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

import { cn } from '@dadei/ui/lib/platform/shared/cn';
import { veilEase } from '@dadei/ui/lib/platform/shared/motion';
import {
  settingsPrimaryButtonClass,
} from '@dadei/ui/components/settings/layout';

export type GlassModalLayer = 'assistant' | 'settings';

const LAYER_Z: Record<GlassModalLayer, { overlay: string; content: string }> = {
  assistant: { overlay: 'z-[260]', content: 'z-[261]' },
  settings: { overlay: 'z-300', content: 'z-310' },
};

export type GlassAlertModalVariant = 'default' | 'destructive';

function useGlassModalMotion() {
  const prefersReducedMotion = useReducedMotion();

  return {
    overlayTransition: prefersReducedMotion
      ? { duration: 0.12 }
      : { duration: 0.22, ease: veilEase },
    contentInitial: prefersReducedMotion
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.96, y: 8 },
    contentAnimate: { opacity: 1, scale: 1, y: 0 },
    contentExit: prefersReducedMotion
      ? { opacity: 0, transition: { duration: 0.1 } }
      : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.16, ease: veilEase } },
    contentTransition: prefersReducedMotion
      ? { duration: 0.12 }
      : { duration: 0.26, ease: veilEase },
  };
}

const accentIconClass =
  'border-emerald-500/20 bg-emerald-500/8 text-emerald-300/80';

const modalCancelButtonClass =
  'w-full rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200';

const modalConfirmButtonClass = cn(
  settingsPrimaryButtonClass,
  'w-full text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50',
);

export type GlassAlertModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  variant?: GlassAlertModalVariant;
  icon?: LucideIcon;
  layer?: GlassModalLayer;
  size?: 'sm' | 'md';
  children?: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  confirmingLabel?: string;
  confirming?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  className?: string;
};

export function GlassAlertModal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  layer = 'settings',
  size = 'md',
  children,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmingLabel,
  confirming = false,
  confirmDisabled = false,
  onConfirm,
  className,
}: GlassAlertModalProps) {
  const motionPreset = useGlassModalMotion();
  const z = LAYER_Z[layer];
  const panelWidth = size === 'sm' ? 'w-[min(92vw,24rem)]' : 'w-[min(92vw,28rem)]';

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <AlertDialog.Portal forceMount>
            <AlertDialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={motionPreset.overlayTransition}
                className={cn('fixed inset-0 bg-zinc-950/65 backdrop-blur-[2px]', z.overlay)}
              />
            </AlertDialog.Overlay>
            <AlertDialog.Content
              className={cn(
                'fixed inset-0 flex items-center justify-center border-0 bg-transparent p-4 shadow-none outline-none',
                z.content,
              )}
              style={{ top: 0, left: 0, transform: 'none' }}
            >
              <motion.div
                initial={motionPreset.contentInitial}
                animate={motionPreset.contentAnimate}
                exit={motionPreset.contentExit}
                transition={motionPreset.contentTransition}
                className={cn(
                  'glass-panel conic-border-tour relative rounded-2xl border border-white/8 p-6 shadow-xl shadow-black/30',
                  panelWidth,
                  className,
                )}
              >
                <div className={cn('flex gap-3', Icon ? 'items-start' : 'flex-col')}>
                  {Icon ? (
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                        accentIconClass,
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <AlertDialog.Title className="text-lg font-semibold tracking-tight text-zinc-50">
                      {title}
                    </AlertDialog.Title>
                    <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-zinc-400 font-secondary">
                      {description}
                    </AlertDialog.Description>
                  </div>
                </div>

                {children ? <div className="mt-4">{children}</div> : null}

                <div className="mt-6 border-t border-white/6 pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <AlertDialog.Cancel asChild>
                      <button type="button" className={modalCancelButtonClass}>
                        {cancelLabel}
                      </button>
                    </AlertDialog.Cancel>
                    <button
                      type="button"
                      disabled={confirmDisabled || confirming}
                      onClick={() => void onConfirm()}
                      className={modalConfirmButtonClass}
                    >
                      {confirming ? (confirmingLabel ?? confirmLabel) : confirmLabel}
                    </button>
                  </div>
                </div>
              </motion.div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        ) : null}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}
