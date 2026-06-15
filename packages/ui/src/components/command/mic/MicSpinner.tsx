import { motion } from 'framer-motion';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

export default function MicSpinner({ className }: { className: string }) {
  return (
    <motion.div
      className={cn(
        'absolute inset-0 z-20 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent',
        className,
      )}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}
