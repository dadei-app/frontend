import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { cn } from '@dadei/ui/lib/cn';

interface MicrophoneButtonProps {
  disableSpaceToggle?: boolean;
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
  const isCommandProcessing =
    state === 'listening' || state === 'thinking' || state === 'responding';
  const isAssistantFollowupReady = state === 'follow_up';

  useEffect(() => {
    if (disableSpaceToggle) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !micBlocked) {
        e.preventDefault();
        if (!isIdle || isAssistantMode) {
          cancel();
        } else {
          void toggleService();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [micBlocked, toggleService, disableSpaceToggle, isIdle, cancel, isAssistantMode]);

  const handleClick = async () => {
    if (micBlocked) return;
    if (!isIdle || isAssistantMode) {
      cancel();
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
          !micBlocked && !isServiceEnabled
            ? { scale: 1.05, transition: { duration: 0.15 } }
            : {}
        }
        whileTap={!micBlocked ? { scale: 0.95, transition: { duration: 0.1 } } : {}}
        className={cn(
          'relative flex h-40 w-40 items-center justify-center rounded-full border-[3px] transition-[background-image,box-shadow,opacity,border-color] duration-300',
          'focus:outline-none focus:ring-4 focus:ring-emerald-500/25',
          micBlocked
            ? 'cursor-not-allowed border-white/15 bg-zinc-700 opacity-60'
            : isCommandProcessing || isAssistantFollowupReady
              ? 'cursor-pointer border-sky-100/35 bg-[linear-gradient(132deg,rgba(37,99,235,0.28),rgba(14,165,233,0.25)_45%,rgba(186,230,253,0.22))] shadow-[0_0_32px_rgba(37,99,235,0.35),0_0_68px_rgba(14,165,233,0.22)] ring-1 ring-sky-200/35 backdrop-blur-xl'
              : isAssistantMode
                ? 'cursor-pointer border-emerald-100/35 bg-[linear-gradient(132deg,rgba(20,184,166,0.24),rgba(16,185,129,0.22)_45%,rgba(167,243,208,0.22))] shadow-[0_0_32px_rgba(16,185,129,0.35),0_0_68px_rgba(16,185,129,0.22)] ring-1 ring-emerald-200/35 backdrop-blur-xl'
                : isServiceEnabled
                  ? 'cursor-pointer border-white/15 bg-linear-to-br from-rose-500 to-rose-700 shadow-[0_0_32px_rgba(225,29,72,0.5),0_0_64px_rgba(225,29,72,0.22)]'
                  : 'cursor-pointer border-white/15 bg-linear-to-br from-emerald-500 to-emerald-700 shadow-[0_0_28px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]',
        )}
      >
        {isServiceEnabled && !micBlocked && isIdle && !isAssistantMode && (
          <>
            {[{ delay: 0 }, { delay: 0.4 }, { delay: 0.8 }].map(({ delay }) => (
              <div
                key={delay}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  className="h-full w-full rounded-full border-2 border-[rgba(255,68,68,0.6)] bg-transparent"
                  animate={{
                    scale: [1.05, 2],
                    opacity: [0, 0.6, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay,
                  }}
                />
              </div>
            ))}
          </>
        )}

        {isAssistantFollowupReady && !micBlocked && (
          <>
            {[{ delay: 0 }, { delay: 0.4 }, { delay: 0.8 }].map(({ delay }) => (
              <div
                key={`blue-${delay}`}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  className="h-full w-full rounded-full border-2 border-[rgba(56,189,248,0.6)] bg-transparent"
                  animate={{
                    scale: [1.05, 2],
                    opacity: [0, 0.6, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay,
                  }}
                />
              </div>
            ))}
          </>
        )}

        {!isServiceEnabled && !micBlocked && isIdle && !isAssistantMode && (
          <motion.div
            className="absolute inset-0 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 opacity-0"
            animate={{
              opacity: [0, 0.3, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {isAssistantMode && !micBlocked && isIdle && (
          <>
            <div
              className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(ellipse_90%_90%_at_50%_0%,rgba(236,253,245,0.5),transparent_50%),radial-gradient(ellipse_80%_85%_at_50%_100%,rgba(16,185,129,0.25),transparent_75%)]"
              aria-hidden
            />
            <motion.div
              className="pointer-events-none absolute inset-y-[12%] left-[-30%] w-[26%] rounded-full bg-[linear-gradient(90deg,transparent,rgba(236,253,245,0.4),transparent)]"
              animate={{ x: ['0%', '500%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
              aria-hidden
            />
          </>
        )}

        <div className="relative z-10 flex items-center justify-center text-white">
          <svg
            className="h-16 w-16 drop-shadow-[0_0_3px_rgba(0,0,0,0.35)]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
          </svg>
        </div>

        {(isTogglingService || isCommandProcessing) && (
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
      </motion.button>
    </div>
  );
}
