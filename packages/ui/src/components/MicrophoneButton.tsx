import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { AudioContext } from '@dadei/ui/contexts/AudioContext';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import MicLevelAura from '@dadei/ui/components/command/MicLevelAura';
import { useTutorialEngaged } from '@dadei/ui/contexts/TutorialContext';
import { deriveMicAppearance } from '@dadei/ui/lib/assistant/voice/micAppearance';

interface MicrophoneButtonProps {
  disableSpaceToggle?: boolean;
}

const RIPPLE_COLORS = {
  red: 'rgba(255, 68, 68, 0.6)',
} as const;

const MIC_SHELL =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] backdrop-blur-xl transition-[border-color,box-shadow] duration-700 ease-in-out';

const MIC_GLASS = {
  blue: {
    shell: 'border-sky-100/35 ring-1 ring-sky-200/35',
    fill: 'bg-[linear-gradient(132deg,rgba(37,99,235,0.28),rgba(14,165,233,0.25)_45%,rgba(186,230,253,0.22))]',
    glow: 'shadow-[0_0_32px_rgba(37,99,235,0.35),0_0_68px_rgba(14,165,233,0.22)]',
  },
  red: {
    shell: 'border-rose-100/35 ring-1 ring-rose-200/35',
    fill: 'bg-[linear-gradient(132deg,rgba(225,29,72,0.32),rgba(244,63,94,0.26)_45%,rgba(254,205,211,0.18))]',
    glow: 'shadow-[0_0_32px_rgba(225,29,72,0.45),0_0_68px_rgba(244,63,94,0.22)]',
  },
  green: {
    shell: 'border-emerald-100/35 ring-1 ring-emerald-200/35',
    fill: 'bg-[linear-gradient(132deg,rgba(20,184,166,0.28),rgba(16,185,129,0.24)_45%,rgba(167,243,208,0.2))]',
    glow: 'shadow-[0_0_32px_rgba(16,185,129,0.38),0_0_68px_rgba(16,185,129,0.2)]',
  },
} as const;

const MIC_GRAY_LOCKED =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/10 bg-zinc-800/90';

const MIC_GRAY_LOADING =
  'pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/15 bg-zinc-700/80';

const COLOR_CROSSFADE = { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const };
const RIPPLE_FADE = { duration: 0.45, ease: 'easeOut' as const };
const RING_RHYTHM_MS = [330, 390, 360, 2000] as const;
const RING_LIFETIME_MS = 2000;
const MAX_RINGS = 8;

interface RingParticle {
  id: number;
}

function MicGlassLayer({
  tone,
  visible,
}: {
  tone: keyof typeof MIC_GLASS;
  visible: boolean;
}) {
  const g = MIC_GLASS[tone];
  return (
    <motion.div
      aria-hidden
      className={cn(MIC_SHELL, g.shell, g.fill, g.glow)}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={COLOR_CROSSFADE}
    />
  );
}

function MicSpinner({ className }: { className: string }) {
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

export default function MicrophoneButton({ disableSpaceToggle = false }: MicrophoneButtonProps) {
  const audioContext = useContext(AudioContext);
  const micLevel = audioContext?.micLevel ?? 0;
  const { matchesHotkey } = useSystem();
  const {
    isServiceEnabled,
    toggleService,
    isTogglingService,
    registrationConflict,
    isCommandMode,
  } = useService();
  const { state, cancelCommandMode, cancelProcessing } = useCommand();
  const tutorialActive = useTutorialEngaged();

  const appearance = useMemo(
    () =>
      deriveMicAppearance({
        state,
        isServiceEnabled,
        isCommandMode,
        isTogglingService,
        registrationConflict,
        tutorialActive,
      }),
    [
      state,
      isServiceEnabled,
      isCommandMode,
      isTogglingService,
      registrationConflict,
      tutorialActive,
    ],
  );

  const inputsInert = appearance.action === 'none';

  const [rings, setRings] = useState<RingParticle[]>([]);
  const [showLiveAura, setShowLiveAura] = useState(false);
  const ringIdRef = useRef(0);

  const runMicAction = useCallback(() => {
    if (appearance.action === 'none') return;
    if (appearance.action === 'cancel_processing') {
      cancelProcessing();
      return;
    }
    if (appearance.action === 'exit_command_mode') {
      cancelCommandMode();
      return;
    }
    void toggleService();
  }, [appearance.action, cancelCommandMode, cancelProcessing, toggleService]);

  useEffect(() => {
    if (disableSpaceToggle) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!matchesHotkey(e) || inputsInert) return;
      e.preventDefault();
      runMicAction();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disableSpaceToggle, inputsInert, matchesHotkey, runMicAction]);

  const emitRing = useCallback(() => {
    const id = ringIdRef.current++;
    setRings((prev) => {
      const next = [...prev, { id }];
      if (next.length <= MAX_RINGS) return next;
      return next.slice(next.length - MAX_RINGS);
    });
    window.setTimeout(() => {
      setRings((prev) => prev.filter((ring) => ring.id !== id));
    }, RING_LIFETIME_MS + 80);
  }, []);

  useEffect(() => {
    if (!appearance.showPassiveRipples) return;
    emitRing();
    let rhythmIdx = 0;
    let timeoutId: number | null = null;
    const scheduleNext = () => {
      const waitMs = RING_RHYTHM_MS[rhythmIdx];
      rhythmIdx = (rhythmIdx + 1) % RING_RHYTHM_MS.length;
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
  }, [appearance.showPassiveRipples, emitRing]);

  useEffect(() => {
    if (!appearance.showLiveAura) {
      setShowLiveAura(false);
      return;
    }
    setShowLiveAura(true);
    setRings([]);
  }, [appearance.showLiveAura]);

  const showEnabled = appearance.tone === 'red';
  const showCommandMode = appearance.tone === 'blue';
  const showDisabled = appearance.tone === 'green';

  return (
    <div className="flex flex-col items-center gap-10">
      <motion.button
        data-tutorial-target="mic-button"
        onClick={runMicAction}
        disabled={inputsInert}
        aria-disabled={inputsInert}
        whileHover={
          !inputsInert && showDisabled
            ? { scale: 1.05, transition: { duration: 0.15 } }
            : {}
        }
        whileTap={!inputsInert ? { scale: 0.95, transition: { duration: 0.1 } } : {}}
        className={cn(
          'relative flex h-40 w-40 items-center justify-center rounded-full',
          'focus:outline-none focus:ring-4',
          inputsInert && 'cursor-not-allowed focus:ring-zinc-500/20',
          !inputsInert &&
            (showCommandMode || showEnabled || showDisabled) &&
            'cursor-pointer',
          !inputsInert && showCommandMode && 'focus:ring-sky-500/25',
          !inputsInert && showEnabled && 'focus:ring-rose-500/25',
          !inputsInert && showDisabled && 'focus:ring-emerald-500/25',
        )}
      >
        {appearance.grayChrome === 'locked' ? (
          <div aria-hidden className={MIC_GRAY_LOCKED} />
        ) : appearance.grayChrome === 'loading' ? (
          <div aria-hidden className={MIC_GRAY_LOADING} />
        ) : (
          <>
            <MicGlassLayer tone="red" visible={showEnabled} />
            <MicGlassLayer tone="blue" visible={showCommandMode} />
            <MicGlassLayer tone="green" visible={showDisabled} />
          </>
        )}

        <AnimatePresence>
          {rings.length > 0 ? (
            <motion.div
              key="mic-ripples"
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 overflow-visible"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={RIPPLE_FADE}
            >
              {rings.map((ring) => (
                <div key={ring.id} className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    className="h-full w-full rounded-full border-2 bg-transparent"
                    initial={{ scale: 1.05, opacity: 0, borderColor: RIPPLE_COLORS.red }}
                    animate={{
                      scale: [1.05, 2],
                      opacity: [0, 0.62, 0],
                      borderColor: RIPPLE_COLORS.red,
                    }}
                    transition={{ duration: RING_LIFETIME_MS / 1000, ease: 'easeOut' }}
                  />
                </div>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <MicLevelAura visible={showLiveAura} level={micLevel} />

        <div className="relative z-10 flex items-center justify-center text-white">
          <svg
            className="h-16 w-16 drop-shadow-[0_0_3px_rgba(0,0,0,0.35)]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
          </svg>
        </div>

        {appearance.grayChrome === 'loading' ? (
          <MicSpinner className="border-t-zinc-300" />
        ) : null}
        {appearance.showProcessingSpinner ? <MicSpinner className="border-t-sky-200" /> : null}
      </motion.button>
    </div>
  );
}
