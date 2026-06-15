import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { AssistantBubbleStatus } from '@dadei/ui/contexts/CommandContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { formatAssistantStatusLine } from '@dadei/ui/lib/assistant/voice/labels/commandToolLabels';
import {
  typewriterDelayBeforeChar,
  typewriterRevealStep,
} from '@dadei/ui/lib/assistant/voice/ui/typewriterTiming';
import { VOICE_EASE } from '@dadei/ui/lib/assistant/voice/constants';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

const STATUS_ELLIPSIS_CYCLE_MS = 480;
const STACK_EDGE_FADE_PX = 28;
const STACK_SCROLL_EDGE_EPS = 2;
const FLOAT_TOP_PAD = '6.5rem';

type BubblePhase = 'thought' | 'settling' | 'settled';

/* ── Material: one glass recipe, one light source, one shadow ──────────── */
/* Differentiation is structural (mark + edge), not additive glow. */
const cardBase: CSSProperties = {
  backdropFilter: 'blur(14px) saturate(115%)',
  WebkitBackdropFilter: 'blur(14px) saturate(115%)',
  background: 'rgba(19, 19, 22, 0.80)',
  border: '1px solid rgba(255,255,255,0.075)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 40px -28px rgba(0,0,0,0.75)',
};

// Live thought: same recipe, lifted one notch + a lit emerald hairline.
const cardLive: CSSProperties = {
  backdropFilter: 'blur(16px) saturate(120%)',
  WebkitBackdropFilter: 'blur(16px) saturate(120%)',
  background: 'rgba(21, 22, 24, 0.84)',
  border: '1px solid rgba(0,204,106,0.20)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.08), 0 22px 50px -26px rgba(0,0,0,0.8)',
};

function stackEdgeMaskStyle(fadeTop: boolean, fadeBottom: boolean): CSSProperties | undefined {
  if (!fadeTop && !fadeBottom) return undefined;
  const fade = `${STACK_EDGE_FADE_PX}px`;
  let g: string;
  if (fadeTop && fadeBottom)
    g = `linear-gradient(to bottom, transparent 0, #000 ${fade}, #000 calc(100% - ${fade}), transparent 100%)`;
  else if (fadeTop) g = `linear-gradient(to bottom, transparent 0, #000 ${fade}, #000 100%)`;
  else g = `linear-gradient(to bottom, #000 0, #000 calc(100% - ${fade}), transparent 100%)`;
  return { maskImage: g, WebkitMaskImage: g };
}

/* ── Speaker mark: a leading node + label. The only ownership signal. ──── */
function SpeakerMark({
  role,
  live,
  reduce,
}: {
  role: 'user' | 'assistant';
  live: boolean;
  reduce: boolean;
}) {
  const isAssistant = role === 'assistant';
  const dotColor = isAssistant || live ? 'rgb(0,204,106)' : 'rgba(244,244,245,0.45)';
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex h-2 w-2 items-center justify-center">
        {live && !reduce ? (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(0,204,106,0.45)' }}
            animate={{ scale: [1, 2.1], opacity: [0.5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            aria-hidden
          />
        ) : null}
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
      </span>
      {isAssistant ? (
        <span className="font-brand text-[13px] leading-none tracking-[0.04em] text-zinc-200">
          dadei
        </span>
      ) : (
        <span className="font-secondary text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-zinc-500">
          {live ? 'listening' : 'you'}
        </span>
      )}
    </span>
  );
}

/* ── KEPT VERBATIM: assistant flip-status + spinner ────────────────────── */
function StatusSpinnerRing() {
  return (
    <motion.span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-zinc-600/70 border-t-emerald-300/90"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      aria-hidden
    />
  );
}
function AnimatedStatusLine({ base }: { base: string }) {
  const [dotPhase, setDotPhase] = useState(0);
  useEffect(() => setDotPhase(0), [base]);
  useEffect(() => {
    const id = window.setInterval(() => setDotPhase((p) => (p + 1) % 4), STATUS_ELLIPSIS_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [base]);
  return <span className="text-zinc-400">{dotPhase === 0 ? base : `${base}${'.'.repeat(dotPhase)}`}</span>;
}
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

/* ── KEPT: typewriter ──────────────────────────────────────────────────── */
function useTypewriterText(
  target: string,
  enabled: boolean,
  generation: number,
  onFirst?: () => void,
  onDone?: () => void,
) {
  const [out, setOut] = useState('');
  const firstRef = useRef(false);
  const doneRef = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    firstRef.current = false;
    doneRef.current = false;
  }, [generation, target, enabled]);
  useEffect(() => {
    if (!enabled) {
      if (timer.current != null) window.clearTimeout(timer.current);
      setOut(target);
      return;
    }
    let cancelled = false;
    let i = 0;
    const step = () => {
      if (cancelled) return;
      i = Math.min(target.length, i + typewriterRevealStep(target.length - i));
      setOut(target.slice(0, i));
      if (i > 0 && !firstRef.current) {
        firstRef.current = true;
        onFirst?.();
      }
      if (i >= target.length) {
        if (!doneRef.current && target.length > 0) {
          doneRef.current = true;
          onDone?.();
        }
        return;
      }
      const delay = typewriterDelayBeforeChar(target[i - 1] ?? '', target.length - i);
      timer.current = window.setTimeout(step, delay);
    };
    setOut('');
    i = 0;
    timer.current = window.setTimeout(step, target.length ? typewriterDelayBeforeChar(target[0], target.length) : 0);
    return () => {
      cancelled = true;
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [enabled, target, generation, onFirst, onDone]);
  return enabled ? out : target;
}

/* ── The bubble ────────────────────────────────────────────────────────── */
export interface CommandBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  phase: BubblePhase;
  floating?: boolean;
  interim?: boolean;
  assistantStatus?: AssistantBubbleStatus;
  statusLine?: string | null;
  typewriterEnabled?: boolean;
  typewriterGeneration?: number;
  onTypewriterFirstChar?: () => void;
  onTypewriterComplete?: () => void;
}

export default function CommandBubble({
  role,
  text,
  phase,
  floating = false,
  interim = false,
  assistantStatus = 'done',
  statusLine = null,
  typewriterEnabled = false,
  typewriterGeneration = 0,
  onTypewriterFirstChar,
  onTypewriterComplete,
}: CommandBubbleProps) {
  const reduce = useReducedMotion();
  const isAssistant = role === 'assistant';
  const live = !isAssistant && phase === 'thought';
  const target = text.trim();

  const useTw = isAssistant && typewriterEnabled && assistantStatus === 'revealing';
  const typed = useTypewriterText(target, useTw, typewriterGeneration, onTypewriterFirstChar, onTypewriterComplete);
  const visible = useTw ? typed : target;

  const showStatus =
    isAssistant && !!statusLine && (assistantStatus === 'pending' || assistantStatus === 'streaming');
  const showBody = showStatus || visible.length > 0 || live;
  const listeningEmpty = live && !visible.length && !interim;

  return (
    <motion.div
      layout
      className="relative w-full min-w-0 shrink-0"
      initial={false}
      animate={{ scale: phase === 'settling' ? [1, 0.99, 1] : 1 }}
      transition={{ duration: 0.4, ease: VOICE_EASE }}
    >
      <motion.div
        layout
        className="relative overflow-hidden"
        animate={{ borderRadius: live ? 20 : 16 }}
        transition={{ duration: 0.4, ease: VOICE_EASE }}
        style={live ? cardLive : cardBase}
      >
        {/* single top specular — the one light source */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.05] to-transparent"
        />
        {/* lit edge only while live; this is the 'thought' affordance */}
        {live ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/45 to-transparent"
          />
        ) : null}

        <div className={cn('relative min-w-0', floating || live ? 'px-5 py-4' : 'px-5 py-3.5')}>
          <SpeakerMark role={role} live={live} reduce={!!reduce} />
          {showBody ? (
            <div className="mt-2.5 min-w-0">
              {showStatus && statusLine ? (
                <AssistantLoadingStatus line={statusLine} />
              ) : listeningEmpty ? (
                <p className="font-primary text-[15px] leading-relaxed text-zinc-500">
                  Waiting for you
                  <span className="ml-0.5 inline-block h-[1.05em] w-px translate-y-[2px] bg-emerald-300/80 align-middle" />
                </p>
              ) : (
                <p
                  className={cn(
                    'font-primary whitespace-pre-wrap text-[15px] leading-[1.65] wrap-anywhere',
                    interim ? 'text-zinc-400' : 'text-zinc-100',
                  )}
                >
                  {visible}
                  {interim ? (
                    <motion.span
                      className="ml-0.5 inline-block h-[1.05em] w-px translate-y-[2px] bg-emerald-300 align-middle"
                      animate={reduce ? undefined : { opacity: [1, 0.1, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                      aria-hidden
                    />
                  ) : null}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Stack: floating live bubble settles into the column via shared layoutId ── */
export function CommandBubbleStack() {
  const {
    state,
    bubbleHistory,
    liveTurnId,
    userBubbleText,
    userCaptionInterim,
    assistantBubbleText,
    assistantBubbleStatus,
    assistantStatusLine,
    notifyAssistantRevealStarted,
    notifyAssistantRevealComplete,
  } = useCommand();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [edgeMask, setEdgeMask] = useState<CSSProperties | undefined>(undefined);
  const [twGen, setTwGen] = useState(0);
  const prevStatus = useRef(assistantBubbleStatus);

  useEffect(() => {
    if (assistantBubbleStatus === 'revealing' && prevStatus.current !== 'revealing') setTwGen((g) => g + 1);
    prevStatus.current = assistantBubbleStatus;
  }, [assistantBubbleStatus]);

  const sync = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + STACK_SCROLL_EDGE_EPS) {
      setEdgeMask(undefined);
      el.scrollTop = 0;
      return;
    }
    setEdgeMask(
      stackEdgeMaskStyle(
        scrollTop > STACK_SCROLL_EDGE_EPS,
        scrollTop + clientHeight < scrollHeight - STACK_SCROLL_EDGE_EPS,
      ),
    );
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const run = () => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      sync();
    };
    run();
    const raf = window.requestAnimationFrame(run);
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(run);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      window.cancelAnimationFrame(raf);
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [bubbleHistory, liveTurnId, userBubbleText, assistantBubbleText, assistantStatusLine, assistantBubbleStatus]);

  const assistantBusy = state === 'thinking' || state === 'responding';
  const hasAssistantLive = assistantBusy || assistantBubbleText.trim().length > 0 || !!assistantStatusLine;
  const showFloatingUser = !!liveTurnId && (state === 'listening' || state === 'transcribing');
  const showStackedUser =
    !!liveTurnId &&
    userBubbleText.trim().length > 0 &&
    !showFloatingUser &&
    (state === 'thinking' || state === 'responding' || state === 'follow_up');
  const liveStackActive = showStackedUser || hasAssistantLive;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-visible">
      <LayoutGroup id="command-bubble-stack">
        <AnimatePresence mode="popLayout">
          {showFloatingUser && liveTurnId ? (
            <motion.div
              key={`float-${liveTurnId}`}
              layout
              layoutId={`cmd-user-${liveTurnId}`}
              className="pointer-events-none absolute inset-x-0 top-0 z-50 mx-auto w-full max-w-[min(100%,28rem)] px-2"
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.26, ease: VOICE_EASE } }}
              transition={{ type: 'spring', stiffness: 440, damping: 34 }}
            >
              <CommandBubble role="user" text={userBubbleText} phase="thought" floating interim={userCaptionInterim} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ ...(edgeMask ?? {}), paddingTop: showFloatingUser ? FLOAT_TOP_PAD : undefined }}
        >
          <div
            ref={scrollRef}
            className="h-full min-h-0 overflow-y-auto overscroll-contain scroll-smooth px-1 py-3 [scrollbar-color:rgba(161,161,170,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/45"
          >
            <div className="mx-auto flex w-full max-w-[min(100%,28rem)] flex-col gap-2.5">
              {bubbleHistory.map((turn) => (
                <div key={turn.id} className="flex w-full flex-col gap-2.5">
                  {turn.userText?.trim() ? (
                    <motion.div layout layoutId={`cmd-user-${turn.id}`}>
                      <CommandBubble role="user" text={turn.userText} phase="settled" />
                    </motion.div>
                  ) : null}
                  {turn.assistantText?.trim() ? (
                    <motion.div layout layoutId={`cmd-asst-${turn.id}`}>
                      <CommandBubble role="assistant" text={turn.assistantText} phase="settled" assistantStatus="done" />
                    </motion.div>
                  ) : null}
                </div>
              ))}

              {liveTurnId && liveStackActive ? (
                <div className="flex w-full flex-col gap-2.5">
                  {showStackedUser ? (
                    <motion.div layout layoutId={`cmd-user-${liveTurnId}`}>
                      <CommandBubble role="user" text={userBubbleText} phase="settled" />
                    </motion.div>
                  ) : null}
                  {hasAssistantLive ? (
                    <motion.div layout layoutId={`cmd-asst-${liveTurnId}`}>
                      <CommandBubble
                        role="assistant"
                        text={assistantBubbleText}
                        phase="thought"
                        assistantStatus={assistantBubbleStatus}
                        statusLine={assistantStatusLine}
                        typewriterEnabled={assistantBubbleStatus === 'revealing'}
                        typewriterGeneration={twGen}
                        onTypewriterFirstChar={notifyAssistantRevealStarted}
                        onTypewriterComplete={notifyAssistantRevealComplete}
                      />
                    </motion.div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}