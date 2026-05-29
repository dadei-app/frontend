import { useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { cn } from '@dadei/ui/lib/cn';

interface MicrophoneButtonProps {
  disableSpaceToggle?: boolean;
}

const RIPPLE_DELAYS = [{ delay: 0 }, { delay: 0.4 }, { delay: 0.8 }] as const;

const RIPPLE_COLORS = {
  red: 'rgba(255, 68, 68, 0.6)',
  blue: 'rgba(56, 189, 248, 0.6)',
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

const COLOR_CROSSFADE = { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const };
const RIPPLE_FADE = { duration: 0.45, ease: 'easeOut' as const };

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

/** Pulse rings; remount when ripples go hidden so they always start fresh on show. */
function MicRippleRings({ tone }: { tone: keyof typeof RIPPLE_COLORS }) {
  return (
    <>
      {RIPPLE_DELAYS.map(({ delay }) => (
        <div key={delay} className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="h-full w-full rounded-full border-2 bg-transparent"
            initial={{ scale: 1.05, opacity: 0, borderColor: RIPPLE_COLORS[tone] }}
            animate={{
              scale: [1.05, 2],
              opacity: [0, 0.6, 0],
              borderColor: RIPPLE_COLORS[tone],
            }}
            transition={{
              scale: { duration: 2, repeat: Infinity, ease: 'easeOut', delay },
              opacity: { duration: 2, repeat: Infinity, ease: 'easeOut', delay },
              borderColor: COLOR_CROSSFADE,
            }}
          />
        </div>
      ))}
    </>
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
  const {
    isServiceEnabled,
    toggleService,
    isTogglingService,
    registrationConflict,
    isAssistantMode,
  } = useService();
  const { state, cancel } = useCommand();

  const micBlocked = isTogglingService || registrationConflict || state === 'locked';
  const isIdle = state === 'idle';
  const isFollowUp = state === 'follow_up';
  const isListening = state === 'listening';
  const isAwaitingResponse = state === 'thinking' || state === 'responding';
  const inActiveSession = !isIdle || isAssistantMode;

  const useAssistantBlue =
    !micBlocked &&
    (isAssistantMode || isListening || isAwaitingResponse || isFollowUp);
  const usePassiveRed = !micBlocked && isIdle && isServiceEnabled && !isAssistantMode;
  const usePassiveGreen = !micBlocked && isIdle && !isServiceEnabled && !isAssistantMode;

  const showBlueRipples =
    useAssistantBlue && (isFollowUp || isListening || (isIdle && isAssistantMode));
  const showRedRipples = usePassiveRed;
  const showRipples = showBlueRipples || showRedRipples;
  const rippleTone: keyof typeof RIPPLE_COLORS = showBlueRipples ? 'blue' : 'red';
  const showBlueSpinner = !micBlocked && isAwaitingResponse;

  const stopSessionAndDisableService = useCallback(() => {
    cancel();
    if (isServiceEnabled) {
      void toggleService();
    }
  }, [cancel, isServiceEnabled, toggleService]);

  useEffect(() => {
    if (disableSpaceToggle) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !micBlocked) {
        e.preventDefault();
        if (inActiveSession) {
          stopSessionAndDisableService();
        } else {
          void toggleService();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    micBlocked,
    toggleService,
    disableSpaceToggle,
    inActiveSession,
    stopSessionAndDisableService,
  ]);

  const handleClick = async () => {
    if (micBlocked) return;
    if (inActiveSession) {
      stopSessionAndDisableService();
      return;
    }
    await toggleService();
  };

  return (
    <div className="flex flex-col items-center gap-10">
      <motion.button
        onClick={handleClick}
        disabled={micBlocked}
        whileHover={
          !micBlocked && usePassiveGreen
            ? { scale: 1.05, transition: { duration: 0.15 } }
            : {}
        }
        whileTap={!micBlocked ? { scale: 0.95, transition: { duration: 0.1 } } : {}}
        className={cn(
          'relative flex h-40 w-40 items-center justify-center rounded-full',
          'focus:outline-none focus:ring-4',
          micBlocked && 'cursor-not-allowed focus:ring-zinc-500/20',
          !micBlocked && (useAssistantBlue || usePassiveRed || usePassiveGreen) && 'cursor-pointer',
          !micBlocked && useAssistantBlue && 'focus:ring-sky-500/25',
          !micBlocked && usePassiveRed && 'focus:ring-rose-500/25',
          !micBlocked && usePassiveGreen && 'focus:ring-emerald-500/25',
        )}
      >
        {micBlocked ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/15 bg-zinc-700 opacity-60"
          />
        ) : (
          <>
            <MicGlassLayer tone="red" visible={usePassiveRed} />
            <MicGlassLayer tone="blue" visible={useAssistantBlue} />
            <MicGlassLayer tone="green" visible={usePassiveGreen} />
          </>
        )}

        <AnimatePresence>
          {showRipples ? (
            <motion.div
              key="mic-ripples"
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 overflow-visible"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={RIPPLE_FADE}
            >
              <MicRippleRings tone={rippleTone} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="relative z-10 flex items-center justify-center text-white">
          <svg
            className="h-16 w-16 drop-shadow-[0_0_3px_rgba(0,0,0,0.35)]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
          </svg>
        </div>

        {micBlocked ? <MicSpinner className="border-t-zinc-300" /> : null}
        {showBlueSpinner ? <MicSpinner className="border-t-sky-200" /> : null}
      </motion.button>
    </div>
  );
}
