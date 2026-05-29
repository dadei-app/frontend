import { motion } from 'framer-motion';
import { useAudio } from '@dadei/ui/contexts/AudioContext';
import { VOICE_EASE } from '@dadei/ui/lib/voice/voiceConstants';

/** Mic input level shown between the assistant reply and the mic button. */
export default function MicLevelIndicator() {
  const { micLevel } = useAudio();
  const widthPct = Math.max(6, Math.round(micLevel * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.28, ease: VOICE_EASE }}
      className="relative z-40 w-[min(280px,calc(100vw-6rem))]"
      role="meter"
      aria-label="Microphone level"
      aria-valuenow={widthPct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-1 overflow-hidden rounded-full bg-white/15 shadow-[0_0_12px_rgba(34,211,238,0.12)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500/70 to-cyan-300/90 transition-[width] duration-75"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </motion.div>
  );
}
