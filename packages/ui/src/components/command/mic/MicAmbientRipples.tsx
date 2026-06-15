import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const RIPPLE_COLOR = 'rgba(255, 68, 68, 0.6)';
const RIPPLE_RHYTHM_MS = [330, 390, 360, 2000] as const;
const RIPPLE_LIFETIME_MS = 2000;
const RIPPLE_MAX = 8;
const RIPPLE_FADE = { duration: 0.45, ease: 'easeOut' as const };

const RIPPLE_RING_MOTION = {
  initial: {
    scale: 1.05,
    opacity: 0,
    borderColor: RIPPLE_COLOR,
  },
  animate: {
    scale: [1.05, 2],
    opacity: [0, 0.62, 0],
    borderColor: RIPPLE_COLOR,
  },
  transition: {
    duration: RIPPLE_LIFETIME_MS / 1000,
    ease: 'easeOut' as const,
  },
};

function nextRippleDelayMs(rhythmIndex: number): number {
  return RIPPLE_RHYTHM_MS[rhythmIndex % RIPPLE_RHYTHM_MS.length];
}

function useAmbientRippleRings(active: boolean): number[] {
  const [ringIds, setRingIds] = useState<number[]>([]);
  const ringIdRef = useRef(0);

  const emitRing = useCallback(() => {
    const id = ringIdRef.current++;
    setRingIds((prev) => {
      const next = [...prev, id];
      if (next.length <= RIPPLE_MAX) return next;
      return next.slice(next.length - RIPPLE_MAX);
    });
    window.setTimeout(() => {
      setRingIds((prev) => prev.filter((ringId) => ringId !== id));
    }, RIPPLE_LIFETIME_MS + 80);
  }, []);

  useEffect(() => {
    if (!active) {
      setRingIds([]);
      return;
    }

    emitRing();
    let rhythmIdx = 0;
    let timeoutId: number | null = null;

    const scheduleNext = () => {
      const waitMs = nextRippleDelayMs(rhythmIdx);
      rhythmIdx += 1;
      timeoutId = window.setTimeout(() => {
        emitRing();
        scheduleNext();
      }, waitMs);
    };

    scheduleNext();

    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [active, emitRing]);

  return ringIds;
}

export interface MicAmbientRipplesProps {
  active: boolean;
}

export default function MicAmbientRipples({ active }: MicAmbientRipplesProps) {
  const ringIds = useAmbientRippleRings(active);

  return (
    <AnimatePresence>
      {ringIds.length > 0 ? (
        <motion.div
          key="mic-ripples"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-visible"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={RIPPLE_FADE}
        >
          {ringIds.map((id) => (
            <div key={id} className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="h-full w-full rounded-full border-2 bg-transparent"
                initial={RIPPLE_RING_MOTION.initial}
                animate={RIPPLE_RING_MOTION.animate}
                transition={RIPPLE_RING_MOTION.transition}
              />
            </div>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
