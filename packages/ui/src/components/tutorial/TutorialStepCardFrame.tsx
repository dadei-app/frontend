import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@dadei/ui/lib/shared/cn';

/** Pulsing emerald ring — same animation as the landing hero scroll CTA on hover, always on here. */
export default function TutorialStepCardFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'relative overflow-visible rounded-2xl border border-emerald-200/60 bg-zinc-950/80',
        'shadow-[0_0_0_1px_rgba(167,243,208,0.3)_inset,0_18px_50px_-18px_rgba(16,185,129,0.45)]',
        'backdrop-blur-xl',
        className,
      )}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-2xl border border-emerald-200/45"
        style={{ transformOrigin: '50% 50%' }}
        initial={{ scale: 1, opacity: 0.85 }}
        animate={
          reduceMotion
            ? { scale: 1, opacity: 0.5 }
            : {
                scale: [1, 1, 1.12, 1.12, 1, 1],
                opacity: [0.85, 0.85, 0.25, 0.25, 0.85, 0.85],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                duration: 8,
                times: [0, 0.1, 0.22, 0.52, 0.72, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      />
      <div className="relative z-10 p-5">{children}</div>
    </div>
  );
}
