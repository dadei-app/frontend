
import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

/** Above settings shell (250); below settings modals (300). */
const TOOLTIP_PORTAL_Z = 280;

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'error';
  show?: boolean;
  position?: 'top' | 'bottom';
}

export default function Tooltip({
  content,
  children,
  variant = 'default',
  show,
  position = 'bottom',
}: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const targetRef = useRef<HTMLDivElement>(null);

  const isVisible = show !== undefined ? show : isHovered;

  const updatePosition = useCallback(() => {
    if (!isVisible || !targetRef.current) return;
    const rect = targetRef.current.getBoundingClientRect();
    if (position === 'bottom') {
      setCoords({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    } else {
      setCoords({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [isVisible, position]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, content]);

  useLayoutEffect(() => {
    if (!isVisible) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isVisible, updatePosition]);

  const variantStyles = {
    default: 'bg-zinc-800 text-zinc-100 border border-white/10',
    success: 'bg-emerald-950/95 text-emerald-100 border border-emerald-500/25',
    error: 'bg-rose-950/95 text-rose-100 border border-rose-500/25',
  };

  const bubble =
    typeof document !== 'undefined' ? (
      <AnimatePresence>
        {isVisible ? (
          <motion.div
            key="tooltip-bubble"
            initial={{ opacity: 0, y: position === 'bottom' ? -10 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: position === 'bottom' ? -10 : 10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed px-3 py-1.5 text-xs font-medium shadow-lg font-secondary',
              '-translate-x-1/2 whitespace-nowrap rounded-lg',
              variantStyles[variant]
            )}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: TOOLTIP_PORTAL_Z,
              ...(position === 'top' ? { transform: 'translate(-50%, -100%)' } : {}),
            }}
          >
            {content}
            <div
              className={cn(
                'absolute h-2 w-2 rotate-45',
                position === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2' : '-bottom-1 left-1/2 -translate-x-1/2',
                variant === 'default' && 'bg-zinc-800',
                variant === 'success' && 'bg-emerald-950',
                variant === 'error' && 'bg-rose-950'
              )}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    ) : null;

  return (
    <div
      ref={targetRef}
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {bubble ? createPortal(bubble, document.body) : null}
    </div>
  );
}
