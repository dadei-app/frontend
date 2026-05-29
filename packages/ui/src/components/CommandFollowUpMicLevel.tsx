import { motion } from 'framer-motion';
import { useAudio } from '@dadei/ui/contexts/AudioContext';
import { VOICE_EASE } from '@dadei/ui/lib/voice/voiceConstants';

/** Mic input level shown in follow-up, between the assistant reply and the mic button. */
export default function CommandFollowUpMicLevel() {
  const { micLevel } = useAudio();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.28, ease: VOICE_EASE }}
      className="w-full max-w-[200px] px-1"
      aria-hidden
    >
      <div className="h-0.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan-400/80 transition-[width] duration-75"
          style={{ width: `${Math.round(micLevel * 100)}%` }}
        />
      </div>
    </motion.div>
  );
}
