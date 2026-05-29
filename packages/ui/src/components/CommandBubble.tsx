import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CommandState, AssistantBubbleStatus } from '@dadei/ui/contexts/CommandContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useAudio } from '@dadei/ui/contexts/AudioContext';
import { VOICE_EASE } from '@dadei/ui/lib/voice/voiceConstants';

const STATE_TINT: Record<CommandState, string> = {
  idle: 'transparent',
  listening:
    'radial-gradient(circle at 50% 100%, rgba(34,211,238,0.06), transparent 70%)',
  thinking: 'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.05), transparent 70%)',
  responding:
    'radial-gradient(circle at 50% 50%, rgba(96,165,250,0.06), transparent 70%)',
  follow_up:
    'radial-gradient(circle at 50% 0%, rgba(110,231,183,0.05), transparent 70%)',
  locked: 'transparent',
};

function CommandBubbleGlassFilter() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      className="pointer-events-none absolute"
    >
      <defs>
        <filter id="dadei-command-bubble-glass" x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </defs>
    </svg>
  );
}

const glassShellStyle: CSSProperties = {
  backdropFilter: 'blur(12px) saturate(108%)',
  WebkitBackdropFilter: 'blur(12px) saturate(108%)',
  background: 'rgba(24, 24, 27, 0.88)',
  border: '1px solid rgba(255, 255, 255, 0.09)',
  boxShadow:
    'inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.12), 0 10px 28px -14px rgba(0, 0, 0, 0.4)',
  filter: 'url(#dadei-command-bubble-glass)',
};

interface GlassBubbleProps {
  role: 'user' | 'assistant';
  label: string;
  text: string;
  state: CommandState;
  assistantStatus?: AssistantBubbleStatus;
  activeToolCall?: string;
  micLevel?: number;
  showMicLevel?: boolean;
  animateEntry?: boolean;
}

function GlassBubble({
  role,
  label,
  text,
  state,
  assistantStatus,
  activeToolCall,
  micLevel = 0,
  showMicLevel = false,
  animateEntry = true,
}: GlassBubbleProps) {
  const isAssistant = role === 'assistant';
  const hasText = text.trim().length > 0;
  const showCursor =
    isAssistant && assistantStatus === 'streaming' && hasText;
  const showMicBar = showMicLevel && !hasText;

  return (
    <motion.div
      initial={animateEntry ? { opacity: 0, y: 12, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: VOICE_EASE }}
      className="relative w-full max-w-[640px]"
    >
      <div className="relative overflow-hidden rounded-2xl" style={glassShellStyle}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ background: STATE_TINT[state] }}
          aria-hidden
        />
        <div className="relative px-5 py-4">
          <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            {label}
          </p>
          {hasText ? (
            <p className="font-primary mt-1 text-[15px] leading-relaxed text-zinc-100">
              {text}
              {showCursor ? (
                <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-sky-300/90 align-middle">
                  &nbsp;
                </span>
              ) : null}
            </p>
          ) : null}
          {activeToolCall && isAssistant && hasText ? (
            <p className="mt-2 font-secondary text-[11px] font-medium tracking-wide text-white/55">
              {activeToolCall}…
            </p>
          ) : null}
          {showMicBar ? (
            <div className={hasText ? 'mt-3' : 'mt-2'}>
              <div className="h-0.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-400/80 transition-[width] duration-75"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export default function CommandBubble() {
  const {
    state,
    userBubbleText,
    assistantBubbleText,
    assistantBubbleStatus,
    activeToolCall,
  } = useCommand();
  const { micLevel } = useAudio();

  if (state === 'idle' || state === 'locked') return null;

  const capturingUser = state === 'listening' || state === 'follow_up';
  const showUser =
    capturingUser || state === 'thinking' || state === 'responding';
  const assistantHasText = assistantBubbleText.trim().length > 0;
  const showAssistant =
    assistantHasText &&
    (state === 'responding' ||
      state === 'thinking' ||
      (state === 'follow_up' && assistantBubbleStatus === 'done'));

  return (
    <>
      <CommandBubbleGlassFilter />
      <motion.div
        layout
        className="mb-6 flex w-full max-w-[640px] flex-col gap-3"
      >
        {showUser ? (
          <GlassBubble
            role="user"
            label="You"
            text={userBubbleText}
            state={state}
            micLevel={micLevel}
            showMicLevel={capturingUser}
          />
        ) : null}
        <AnimatePresence>
          {showAssistant ? (
            <motion.div
              key="assistant-command-bubble"
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.36, ease: VOICE_EASE }}
              className="w-full"
            >
              <GlassBubble
                role="assistant"
                label="Dadei"
                text={assistantBubbleText}
                state={state}
                assistantStatus={assistantBubbleStatus}
                activeToolCall={activeToolCall}
                animateEntry={false}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
