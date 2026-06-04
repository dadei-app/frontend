import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ToastType } from '@dadei/ui/types/models.types';
import { cn } from '@dadei/ui/lib/shared/cn';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  autoDismiss?: boolean;
}

export default function Toast({ message, type, onClose, autoDismiss = true }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (autoDismiss && type !== 'error') {
      const duration = Math.max(2800, Math.min(7500, message.length * 45));
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [message, type, autoDismiss, handleClose]);

  const accent = {
    info: 'border-cyan-500/35 bg-cyan-950/50 text-cyan-100',
    error: 'border-rose-500/40 bg-rose-950/55 text-rose-100',
    warning: 'border-amber-500/35 bg-amber-950/50 text-amber-100',
    success: 'border-emerald-500/35 bg-emerald-950/50 text-emerald-100',
  }[type];

  return (
    <button
      type="button"
      onClick={handleClose}
      className={cn(
        'flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 ease-out',
        accent,
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      )}
    >
      <span className="min-w-0 flex-1 leading-snug">{message}</span>
      <X className="mt-0.5 h-4 w-4 shrink-0 opacity-60" strokeWidth={2} aria-hidden />
    </button>
  );
}
