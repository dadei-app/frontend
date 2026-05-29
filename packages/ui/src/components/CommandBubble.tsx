import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { CommandState, AssistantBubbleStatus } from '@dadei/ui/contexts/CommandContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useAudio } from '@dadei/ui/contexts/AudioContext';
import { VOICE_EASE } from '@dadei/ui/lib/voice/voiceConstants';

const STATE_TINT: Record<CommandState, string> = {
  idle: 'transparent',
  listening:
    'radial-gradient(circle at 50% 100%, rgba(34,211,238,0.10), transparent 70%)',
  thinking: 'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.08), transparent 70%)',
  responding:
    'radial-gradient(circle at 50% 50%, rgba(96,165,250,0.09), transparent 70%)',
  follow_up:
    'radial-gradient(circle at 50% 0%, rgba(110,231,183,0.08), transparent 70%)',
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
        <filter id="dadei-command-bubble-glass" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="8" />
        </filter>
      </defs>
    </svg>
  );
}

const glassShellStyle: CSSProperties = {
  backdropFilter: 'blur(10px) saturate(115%)',
  WebkitBackdropFilter: 'blur(10px) saturate(115%)',
  background: 'rgba(24, 24, 27, 0.62)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  boxShadow:
    'inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 -1px 0 rgba(0, 0, 0, 0.14), 0 10px 28px -14px rgba(0, 0, 0, 0.45)',
  filter: 'url(#dadei-command-bubble-glass)',
};

function ThinkingDots() {
  return (
    <div className="mt-2 flex gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-white/30"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
        />
      ))}
    </div>
  );
}

interface GlassBubbleProps {
  role: 'user' | 'assistant';
  label: string;
  text: string;
  state: CommandState;
  assistantStatus?: AssistantBubbleStatus;
  activeToolCall?: string;
  micLevel?: number;
}

function GlassBubble({
  role,
  label,
  text,
  state,
  assistantStatus,
  activeToolCall,
  micLevel = 0,
}: GlassBubbleProps) {
  const isAssistant = role === 'assistant';
  const showCursor =
    isAssistant && assistantStatus === 'streaming' && text.length > 0;
  const showThinking =
    isAssistant && state === 'thinking' && assistantStatus === 'pending';
  const showMicBar = !isAssistant && state === 'listening';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
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
          <p className="font-primary mt-1 text-[15px] leading-relaxed text-zinc-100">
            {text || (isAssistant ? '' : '…')}
            {showCursor ? (
              <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-sky-300/90 align-middle">
                &nbsp;
              </span>
            ) : null}
          </p>
          {activeToolCall && isAssistant ? (
            <p className="mt-2 font-secondary text-[11px] font-medium tracking-wide text-white/55">
              {activeToolCall}…
            </p>
          ) : null}
          {showThinking ? <ThinkingDots /> : null}
          {showMicBar ? (
            <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-400/80 transition-[width] duration-75"
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
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

  const showUser =
    state === 'listening' ||
    state === 'thinking' ||
    state === 'responding' ||
    state === 'follow_up';
  const showAssistant =
    state === 'thinking' || state === 'responding' || state === 'follow_up';

  return (
    <>
      <CommandBubbleGlassFilter />
      <motion.div
        layout
        className="mb-6 flex w-full max-w-[640px] flex-col gap-3"
        animate={
          state === 'follow_up' && assistantBubbleStatus === 'done'
            ? { opacity: [1, 0.92] }
            : { opacity: 1 }
        }
        transition={{ duration: 0.5 }}
      >
        {showUser ? (
          <GlassBubble
            role="user"
            label="You"
            text={userBubbleText}
            state={state}
            micLevel={micLevel}
          />
        ) : null}
        {showAssistant ? (
          <GlassBubble
            role="assistant"
            label="Dadei"
            text={assistantBubbleText}
            state={state}
            assistantStatus={assistantBubbleStatus}
            activeToolCall={activeToolCall}
          />
        ) : null}
      </motion.div>
    </>
  );
}
