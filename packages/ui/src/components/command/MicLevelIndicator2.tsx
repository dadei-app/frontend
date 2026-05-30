import { motion } from 'framer-motion';
import { useAudio } from '@dadei/ui/contexts/AudioContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Blue mic level bar shown while waiting for spoken command input. */
export default function MicLevelIndicator2() {
  const { micLevel } = useAudio();
  const { state } = useCommand();
  const visible = state === 'listening' || state === 'follow_up';
  const pct = Math.round(clamp(micLevel, 0, 1) * 100);
  const glow = 0.2 + clamp(micLevel, 0, 1) * 0.55;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="pointer-events-none relative z-40 mt-3 h-2 w-[min(320px,calc(100vw-7rem))]"
      aria-hidden={!visible}
    >
      <div className="h-full overflow-hidden rounded-full bg-sky-900/25 ring-1 ring-sky-300/15">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sky-500/70 via-cyan-400/80 to-sky-200/90"
          animate={{ width: `${Math.max(8, pct)}%`, boxShadow: `0 0 14px rgba(56,189,248,${glow.toFixed(3)})` }}
          transition={{ duration: 0.09, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}
