import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CommandState, AssistantBubbleStatus } from '@dadei/ui/contexts/CommandContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
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

const glassShellStyle: CSSProperties = {
  backdropFilter: 'blur(6px) saturate(104%)',
  WebkitBackdropFilter: 'blur(6px) saturate(104%)',
  background: 'rgba(24, 24, 27, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.07)',
  boxShadow:
    'inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 -1px 0 rgba(0, 0, 0, 0.08), 0 8px 22px -14px rgba(0, 0, 0, 0.32)',
};

interface GlassBubbleProps {
  role: 'user' | 'assistant';
  label: string;
  text: string;
  state: CommandState;
  assistantStatus?: AssistantBubbleStatus;
  statusLine?: string | null;
  animateEntry?: boolean;
}

function GlassBubble({
  role,
  label,
  text,
  state,
  assistantStatus,
  statusLine = null,
  animateEntry = true,
}: GlassBubbleProps) {
  const isAssistant = role === 'assistant';
  const hasText = text.trim().length > 0;
  const showCursor =
    isAssistant && assistantStatus === 'streaming' && hasText;
  const showStatus = isAssistant && !!statusLine && !hasText;

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
          {showStatus ? (
            <p className="font-primary mt-1 text-[15px] leading-relaxed text-zinc-400">
              <AnimatePresence mode="wait">
                <motion.span
                  key={statusLine}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: VOICE_EASE }}
                  className="inline-block"
                >
                  {statusLine}
                </motion.span>
              </AnimatePresence>
            </p>
          ) : null}
          {hasText ? (
            <p className={`font-primary text-[15px] leading-relaxed text-zinc-100 ${showStatus ? 'mt-3' : 'mt-1'}`}>
              {text}
              {showCursor ? (
                <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-sky-300/90 align-middle">
                  &nbsp;
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export default function TextBubble() {
  const {
    state,
    bubbleHistory,
    userBubbleText,
    assistantBubbleText,
    assistantBubbleStatus,
    assistantStatusLine,
  } = useCommand();

  if (state === 'idle' || state === 'locked') return null;

  const showUser = state === 'listening' || state === 'thinking' || state === 'responding' || state === 'follow_up';
  const assistantHasText = assistantBubbleText.trim().length > 0;
  const assistantIsBusy = state === 'thinking' || state === 'responding';
  const showAssistant = assistantIsBusy || assistantHasText || !!assistantStatusLine;

  const userBubble = showUser && userBubbleText.trim() ? (
    <GlassBubble
      role="user"
      label="You"
      text={userBubbleText}
      state={state}
    />
  ) : null;

  const assistantBubble = (
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
            statusLine={assistantStatusLine}
            animateEntry={false}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <motion.div layout className="flex w-full max-w-[640px] flex-col gap-3">
      {bubbleHistory.map((turn) => (
        <motion.div key={turn.id} layout className="flex w-full flex-col gap-3">
          {turn.userText.trim() ? (
            <GlassBubble role="user" label="You" text={turn.userText} state="follow_up" />
          ) : null}
          {turn.assistantText.trim() ? (
            <GlassBubble
              role="assistant"
              label="Dadei"
              text={turn.assistantText}
              state="follow_up"
              assistantStatus="done"
            />
          ) : null}
        </motion.div>
      ))}
      {userBubble}
      {assistantBubble}
    </motion.div>
  );
}
