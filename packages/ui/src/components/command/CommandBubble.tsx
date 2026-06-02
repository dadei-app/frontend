import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CommandState, AssistantBubbleStatus } from '@dadei/ui/contexts/CommandContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { formatAssistantStatusLine } from '@dadei/ui/lib/commandToolLabels';
import {
  typewriterDelayBeforeChar,
  typewriterRevealStep,
} from '@dadei/ui/lib/typewriterTiming';
import { VOICE_EASE } from '@dadei/ui/lib/voice/voiceConstants';

const STATUS_ELLIPSIS_CYCLE_MS = 480;
/** Alpha mask fade length at clipped scroll edges (not a visible overlay). */
const STACK_EDGE_FADE_PX = 28;
const STACK_SCROLL_EDGE_EPS = 2;

function stackEdgeMaskStyle(fadeTop: boolean, fadeBottom: boolean): CSSProperties | undefined {
  if (!fadeTop && !fadeBottom) return undefined;
  const fade = `${STACK_EDGE_FADE_PX}px`;
  let gradient: string;
  if (fadeTop && fadeBottom) {
    gradient = `linear-gradient(to bottom, transparent 0, #000 ${fade}, #000 calc(100% - ${fade}), transparent 100%)`;
  } else if (fadeTop) {
    gradient = `linear-gradient(to bottom, transparent 0, #000 ${fade}, #000 100%)`;
  } else {
    gradient = `linear-gradient(to bottom, #000 0, #000 calc(100% - ${fade}), transparent 100%)`;
  }
  return { maskImage: gradient, WebkitMaskImage: gradient };
}

const STATE_TINT: Record<CommandState, string> = {
  idle: 'transparent',
  listening:
    'radial-gradient(circle at 50% 100%, rgba(34,211,238,0.06), transparent 70%)',
  transcribing:
    'radial-gradient(circle at 50% 50%, rgba(96,165,250,0.05), transparent 70%)',
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
  typewriterGeneration?: number;
  animateEntry?: boolean;
  onTypewriterFirstChar?: () => void;
  onTypewriterComplete?: () => void;
}

function StatusSpinnerRing() {
  return (
    <motion.span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-zinc-600/70 border-t-sky-300/90"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      aria-hidden
    />
  );
}

/** Cycles: Thinking → Thinking. → Thinking.. → Thinking... */
function AnimatedStatusLine({ base }: { base: string }) {
  const [dotPhase, setDotPhase] = useState(0);

  useEffect(() => {
    setDotPhase(0);
  }, [base]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDotPhase((p) => (p + 1) % 4);
    }, STATUS_ELLIPSIS_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [base]);

  const label = dotPhase === 0 ? base : `${base}${'.'.repeat(dotPhase)}`;

  return (
    <motion.span
      key={`${base}-${dotPhase}`}
      initial={{ opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="text-zinc-400"
    >
      {label}
    </motion.span>
  );
}

/** Tool / thinking labels scroll upward when the status line changes. */
function AssistantLoadingStatus({ line }: { line: string }) {
  const statusBase = formatAssistantStatusLine(line);

  return (
    <span
      className="flex min-h-[1.625rem] min-w-0 items-center gap-2.5 text-[15px] leading-[1.625rem]"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="flex h-[1.625rem] w-3.5 shrink-0 items-center justify-center self-center">
        <StatusSpinnerRing />
      </span>
      <span className="relative h-[1.625rem] min-w-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.span
            key={statusBase}
            initial={{ y: '100%', opacity: 0.2 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0.2 }}
            transition={{ duration: 0.3, ease: VOICE_EASE }}
            className="absolute inset-x-0 top-0 flex h-[1.625rem] min-w-0 items-center truncate"
          >
            <AnimatedStatusLine base={statusBase} />
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
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
  typewriterGeneration = 0,
  animateEntry = true,
  onTypewriterFirstChar,
  onTypewriterComplete,
}: GlassBubbleProps) {
  const isAssistant = role === 'assistant';
  const targetText = text.trim();
  const useTypewriter = isAssistant && typewriterEnabled && assistantStatus === 'revealing';
  const [typewriterText, setTypewriterText] = useState('');
  const firstCharNotifiedRef = useRef(false);
  const completeNotifiedRef = useRef(false);
  const tickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    firstCharNotifiedRef.current = false;
    completeNotifiedRef.current = false;
  }, [typewriterGeneration, targetText, useTypewriter]);

  useEffect(() => {
    if (!useTypewriter) {
      if (tickTimerRef.current != null) {
        window.clearTimeout(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      setTypewriterText(targetText);
      return;
    }

    let cancelled = false;
    let index = 0;

    const runStep = () => {
      if (cancelled) return;

      const backlog = targetText.length - index;
      const step = typewriterRevealStep(backlog);
      index = Math.min(targetText.length, index + step);
      setTypewriterText(targetText.slice(0, index));

      if (index > 0 && !firstCharNotifiedRef.current) {
        firstCharNotifiedRef.current = true;
        onTypewriterFirstChar?.();
      }

      if (index >= targetText.length) {
        if (!completeNotifiedRef.current && targetText.length > 0) {
          completeNotifiedRef.current = true;
          onTypewriterComplete?.();
        }
        return;
      }

      const lastRevealed = targetText[index - 1] ?? '';
      const delay = typewriterDelayBeforeChar(lastRevealed, targetText.length - index);
      tickTimerRef.current = window.setTimeout(runStep, delay);
    };

    setTypewriterText('');
    index = 0;
    const firstDelay = targetText.length
      ? typewriterDelayBeforeChar(targetText[0], targetText.length)
      : 0;
    tickTimerRef.current = window.setTimeout(runStep, firstDelay);

    return () => {
      cancelled = true;
      if (tickTimerRef.current != null) {
        window.clearTimeout(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };
  }, [useTypewriter, targetText, typewriterGeneration, onTypewriterFirstChar, onTypewriterComplete]);

  const visibleText = useTypewriter ? typewriterText : targetText;
  const showStatus =
    isAssistant &&
    !!statusLine &&
    (assistantStatus === 'pending' || assistantStatus === 'streaming');
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
              {showStatus && statusLine ? (
                <AssistantLoadingStatus line={statusLine} />
              ) : (
                <span className="text-zinc-100">{visibleText}</span>
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
    notifyAssistantRevealStarted,
    notifyAssistantRevealComplete,
  } = useCommand();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [edgeMaskStyle, setEdgeMaskStyle] = useState<CSSProperties | undefined>(undefined);
  const [typewriterGeneration, setTypewriterGeneration] = useState(0);
  const prevAssistantStatusRef = useRef(assistantBubbleStatus);

  useEffect(() => {
    if (
      assistantBubbleStatus === 'revealing' &&
      prevAssistantStatusRef.current !== 'revealing'
    ) {
      setTypewriterGeneration((g) => g + 1);
    }
    prevAssistantStatusRef.current = assistantBubbleStatus;
  }, [assistantBubbleStatus]);

  const onRevealStarted = useCallback(() => {
    notifyAssistantRevealStarted();
  }, [notifyAssistantRevealStarted]);

  const onRevealComplete = useCallback(() => {
    notifyAssistantRevealComplete();
  }, [notifyAssistantRevealComplete]);

  const syncStackScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflows = scrollHeight > clientHeight + STACK_SCROLL_EDGE_EPS;

    if (!overflows) {
      setEdgeMaskStyle(undefined);
      el.scrollTop = 0;
      return;
    }

    const fadeTop = scrollTop > STACK_SCROLL_EDGE_EPS;
    const fadeBottom = scrollTop + clientHeight < scrollHeight - STACK_SCROLL_EDGE_EPS;
    setEdgeMaskStyle(stackEdgeMaskStyle(fadeTop, fadeBottom));
  }, []);

  const liveTurnActive = userBubbleText.trim().length > 0;
  const assistantIsBusy = state === 'thinking' || state === 'responding';
  const showAssistant =
    liveTurnActive &&
    (assistantIsBusy || assistantBubbleText.trim().length > 0 || !!assistantStatusLine);

  const userBubble = liveTurnActive ? (
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
      typewriterEnabled={assistantBubbleStatus === 'revealing'}
      typewriterGeneration={typewriterGeneration}
      animateEntry={false}
      onTypewriterFirstChar={onRevealStarted}
      onTypewriterComplete={onRevealComplete}
    />
  ) : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const run = () => {
      const { scrollHeight, clientHeight } = el;
      if (scrollHeight > clientHeight + STACK_SCROLL_EDGE_EPS) {
        el.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      }
      syncStackScroll();
    };

    run();
    const id = window.requestAnimationFrame(run);
    el.addEventListener('scroll', syncStackScroll, { passive: true });
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const content = el.firstElementChild;
    if (content instanceof Element) ro.observe(content);

    return () => {
      window.cancelAnimationFrame(id);
      el.removeEventListener('scroll', syncStackScroll);
      ro.disconnect();
    };
  }, [
    bubbleHistory,
    userBubbleText,
    assistantBubbleText,
    assistantStatusLine,
    assistantBubbleStatus,
    syncStackScroll,
  ]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden" style={edgeMaskStyle}>
        <div
          ref={scrollRef}
          className="h-full min-h-0 overflow-y-auto overscroll-contain scroll-smooth px-1 py-4 [scrollbar-color:rgba(161,161,170,0.5)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/50"
        >
          <div className="flex w-full flex-col gap-3">
            {bubbleHistory.map((turn) => (
              <div key={turn.id} className="flex w-full flex-col gap-3">
                {turn.userText.trim() ? (
                  <GlassBubble
                    role="user"
                    label="You"
                    text={turn.userText}
                    state="follow_up"
                    animateEntry={false}
                  />
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
    </div>
  );
}
