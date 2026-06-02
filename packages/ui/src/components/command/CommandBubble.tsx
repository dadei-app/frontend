import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { CommandState, AssistantBubbleStatus } from '@dadei/ui/contexts/CommandContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { VOICE_EASE } from '@dadei/ui/lib/voice/voiceConstants';

const TYPEWRITER_MS_PER_CHAR = 16;

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
  typewriterEnabled?: boolean;
  animateEntry?: boolean;
}

function TypewriterCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-sky-300/90 align-middle"
      aria-hidden
    />
  );
}

function GlassBubble({
  role,
  label,
  text,
  state,
  assistantStatus,
  statusLine = null,
  typewriterEnabled = false,
  animateEntry = true,
}: GlassBubbleProps) {
  const isAssistant = role === 'assistant';
  const targetText = text.trim();
  const useTypewriter =
    isAssistant && typewriterEnabled && (assistantStatus === 'streaming' || assistantStatus === 'pending');
  const [typewriterText, setTypewriterText] = useState(useTypewriter ? '' : targetText);

  useEffect(() => {
    if (!useTypewriter) {
      setTypewriterText(targetText);
      return;
    }
    if (!targetText) {
      setTypewriterText('');
      return;
    }
    setTypewriterText((prev) => {
      if (targetText.startsWith(prev)) return prev;
      return targetText.slice(0, 1);
    });
  }, [useTypewriter, targetText]);

  useEffect(() => {
    if (!useTypewriter) return;

    const tick = () => {
      setTypewriterText((prev) => {
        if (!targetText) return '';
        if (prev === targetText) return prev;
        if (!targetText.startsWith(prev)) return targetText.slice(0, 1);

        const backlog = targetText.length - prev.length;
        const step = backlog > 48 ? 4 : backlog > 20 ? 3 : backlog > 8 ? 2 : 1;
        return targetText.slice(0, prev.length + step);
      });
    };

    const id = window.setInterval(tick, TYPEWRITER_MS_PER_CHAR);
    return () => window.clearInterval(id);
  }, [useTypewriter, targetText]);

  const isTyping = useTypewriter && typewriterText.length < targetText.length;
  const visibleText = useTypewriter ? typewriterText : targetText;
  const lastStatusRef = useRef<string | null>(null);
  if (statusLine) lastStatusRef.current = statusLine;
  if (!statusLine && !targetText) lastStatusRef.current = null;
  const holdStatus =
    isAssistant && visibleText.length === 0 && !!lastStatusRef.current && !!targetText;
  const statusDisplay = statusLine ?? (holdStatus ? lastStatusRef.current : null);
  const showStatus = !!statusDisplay;
  const showBody = showStatus || visibleText.length > 0;

  return (
    <motion.div
      initial={animateEntry ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: VOICE_EASE }}
      className="w-full min-w-0 shrink-0"
    >
      <div className="relative rounded-2xl" style={glassShellStyle}>
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-[0.06]"
          style={{ background: STATE_TINT[state] }}
          aria-hidden
        />
        <div className="relative min-w-0 px-5 py-4">
          <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            {label}
          </p>
          {showBody ? (
            <p className="font-primary mt-1 whitespace-pre-wrap text-[15px] leading-relaxed wrap-anywhere">
              {showStatus ? (
                <span className="text-zinc-400">{statusDisplay}</span>
              ) : (
                <span className="text-zinc-100">
                  {visibleText}
                  {isTyping ? <TypewriterCursor /> : null}
                </span>
              )}
            </p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export default function CommandBubble() {
  const {
    state,
    bubbleHistory,
    userBubbleText,
    assistantBubbleText,
    assistantBubbleStatus,
    assistantStatusLine,
  } = useCommand();

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const showUser =
    state === 'listening' || state === 'thinking' || state === 'responding' || state === 'follow_up';
  const assistantHasText = assistantBubbleText.trim().length > 0;
  const assistantIsBusy = state === 'thinking' || state === 'responding';
  const showAssistant = assistantIsBusy || assistantHasText || !!assistantStatusLine;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const run = () => {
      const { scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight) {
        el.scrollTop = 0;
        return;
      }
      el.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    };

    run();
    const id = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(id);
  }, [bubbleHistory, userBubbleText, assistantBubbleText, assistantStatusLine, assistantBubbleStatus]);

  const userBubble =
    showUser && userBubbleText.trim() ? (
      <GlassBubble role="user" label="You" text={userBubbleText} state={state} />
    ) : null;

  const assistantBubble = showAssistant ? (
    <GlassBubble
      role="assistant"
      label="Dadei"
      text={assistantBubbleText}
      state={state}
      assistantStatus={assistantBubbleStatus}
      statusLine={assistantStatusLine}
      typewriterEnabled={assistantBubbleStatus !== 'done'}
      animateEntry={false}
    />
  ) : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-1 py-4 [scrollbar-color:rgba(161,161,170,0.5)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/50"
      >
        <div className="flex w-full flex-col gap-3">
          {bubbleHistory.map((turn) => (
            <div key={turn.id} className="flex w-full flex-col gap-3">
              {turn.userText.trim() ? (
                <GlassBubble role="user" label="You" text={turn.userText} state="follow_up" animateEntry={false} />
              ) : null}
              {turn.assistantText.trim() ? (
                <GlassBubble
                  role="assistant"
                  label="Dadei"
                  text={turn.assistantText}
                  state="follow_up"
                  assistantStatus="done"
                  typewriterEnabled={false}
                  animateEntry={false}
                />
              ) : null}
            </div>
          ))}
          {userBubble}
          {assistantBubble}
        </div>
      </div>
    </div>
  );
}
