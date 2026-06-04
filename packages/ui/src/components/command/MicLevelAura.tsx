import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { micLevelAuraMotion } from '@dadei/ui/contexts/AudioContext';

interface MicLevelAuraProps {
  visible: boolean;
  level: number;
}

export default function MicLevelAura({ visible, level }: MicLevelAuraProps) {
  const aura = useMemo(() => micLevelAuraMotion(level, visible), [level, visible]);

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
