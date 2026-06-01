import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface MicLevelAuraProps {
  visible: boolean;
  level: number;
}

export default function MicLevelAura({ visible, level }: MicLevelAuraProps) {
  const aura = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, level));
    return {
      opacity: visible ? 0.44 + clamped * 0.56 : 0,
      scale: visible ? 1.08 + clamped * 0.92 : 0.88,
      y: visible ? -4 - clamped * 22 : 0,
    };
  }, [level, visible]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-[-32%] z-0 rounded-full"
      style={{
        background:
          'radial-gradient(circle, rgba(56,189,248,0.72) 0%, rgba(14,165,233,0.5) 38%, rgba(2,132,199,0.2) 68%, transparent 100%)',
        filter: 'blur(16px)',
      }}
      initial={false}
      animate={aura}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    />
  );
}
