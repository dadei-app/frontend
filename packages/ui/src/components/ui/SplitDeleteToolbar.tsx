import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Trash2, X } from 'lucide-react';
import { cn } from '@dadei/ui/lib/cn';

const DEFAULT_EASE = [0.22, 1, 0.36, 1] as const;
const DEFAULT_IDLE_WIDTH = 36;
const DEFAULT_ARMED_WIDTH = 76;

type SplitDeleteToolbarProps = {
  armed: boolean;
  disabled?: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onConfirm: () => void;
  idleTitle: string;
  idleAriaLabel: string;
  idleVisibleClassName?: string;
  containerClassName?: string;
  armedContainerClassName?: string;
  idleButtonClassName?: string;
  confirmButtonClassName?: string;
  cancelButtonClassName?: string;
  iconClassName?: string;
  idleWidthPx?: number;
  armedWidthPx?: number;
};

export default function SplitDeleteToolbar({
  armed,
  disabled = false,
  onArm,
  onDisarm,
  onConfirm,
  idleTitle,
  idleAriaLabel,
  idleVisibleClassName = '',
  containerClassName,
  armedContainerClassName,
  idleButtonClassName,
  confirmButtonClassName,
  cancelButtonClassName,
  iconClassName = 'h-3.5 w-3.5',
  idleWidthPx = DEFAULT_IDLE_WIDTH,
  armedWidthPx = DEFAULT_ARMED_WIDTH,
}: SplitDeleteToolbarProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      data-split-delete
      initial={false}
      animate={{ width: armed ? armedWidthPx : idleWidthPx }}
      transition={{
        duration: reduceMotion ? 0.01 : 0.26,
        ease: DEFAULT_EASE,
      }}
      className={cn('relative h-9 shrink-0 self-center overflow-hidden', containerClassName)}
      onClick={e => e.stopPropagation()}
    >
      <AnimatePresence initial={false} mode="wait">
        {armed ? (
          <motion.div
            key="del-armed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.09, ease: 'easeOut' }}
            className={cn(
              'flex h-full w-full items-center justify-end gap-1',
              armedContainerClassName
            )}
          >
            <button
              type="button"
              disabled={disabled}
              aria-label="Confirm delete"
              title="Confirm delete"
              onClick={e => {
                e.stopPropagation();
                onConfirm();
              }}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-emerald-400/95 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-45',
                confirmButtonClassName
              )}
            >
              <Check className={iconClassName} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              disabled={disabled}
              aria-label="Cancel"
              title="Cancel"
              onClick={e => {
                e.stopPropagation();
                onDisarm();
              }}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-400/90 transition-colors hover:bg-rose-950/65 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-45',
                cancelButtonClassName
              )}
            >
              <X className={iconClassName} strokeWidth={2.5} />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="del-idle"
            type="button"
            disabled={disabled}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.09, ease: 'easeOut' }}
            title={idleTitle}
            aria-label={idleAriaLabel}
            onClick={e => {
              e.stopPropagation();
              onArm();
            }}
            className={cn(
              'flex h-full w-full items-center justify-center rounded-lg text-rose-400/90 opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-rose-950/70 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-45',
              idleVisibleClassName,
              idleButtonClassName
            )}
          >
            <Trash2 className={iconClassName} strokeWidth={2.2} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
