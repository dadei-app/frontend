import { useContext, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useAssistantRuntimeState } from '@dadei/ui/contexts/AssistantRuntimeContext';
import { AudioContext } from '@dadei/ui/contexts/AudioContext';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import { useTutorialEngaged } from '@dadei/ui/contexts/TutorialContext';
import { deriveMicAppearanceFromRuntime } from '@dadei/ui/lib/assistant/voice/micAppearance';
import { useMicIntent } from '@dadei/ui/lib/assistant/lifecycle/useMicIntent';
import MicAmbientRipples from '@dadei/ui/components/command/mic/MicAmbientRipples';
import MicGlassLayer from '@dadei/ui/components/command/mic/MicGlassLayer';
import MicSpinner from '@dadei/ui/components/command/mic/MicSpinner';
import { MIC_GRAY_LOADING, MIC_GRAY_LOCKED } from '@dadei/ui/components/command/mic/micChrome';

interface MicrophoneButtonProps {
  disableSpaceToggle?: boolean;
}

export default function MicrophoneButton({ disableSpaceToggle = false }: MicrophoneButtonProps) {
  const audioContext = useContext(AudioContext);
  const micLevel = audioContext?.micLevel ?? 0;
  const { matchesHotkey } = useSystem();
  const { permissionsGateOpen } = useService();
  const runtime = useAssistantRuntimeState();
  const tutorialActive = useTutorialEngaged();
  const { submitMicIntent, inputsInert } = useMicIntent();

  const appearance = useMemo(
    () =>
      deriveMicAppearanceFromRuntime(runtime, {
        tutorialActive,
        permissionsGateBlocked: permissionsGateOpen,
      }),
    [permissionsGateOpen, runtime, tutorialActive],
  );

  useEffect(() => {
    if (disableSpaceToggle) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !matchesHotkey(e) || inputsInert) return;
      e.preventDefault();
      submitMicIntent();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disableSpaceToggle, inputsInert, matchesHotkey, submitMicIntent]);

  const showEnabled = appearance.tone === 'red';
  const showCommandMode = appearance.tone === 'blue';
  const showDisabled = appearance.tone === 'green';

  return (
    <div className="flex flex-col items-center gap-10">
      <motion.button
        data-tutorial-target="mic-button"
        onClick={submitMicIntent}
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
            <MicGlassLayer
              tone="blue"
              visible={showCommandMode}
              modulateGlow={appearance.modulateGlassGlow}
              micLevel={micLevel}
            />
            <MicGlassLayer tone="green" visible={showDisabled} />
          </>
        )}

        <MicAmbientRipples active={appearance.showAmbientRipples} />

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
