import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { AssistantBubbleStatus } from '@dadei/ui/contexts/CommandContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { AudioContext } from '@dadei/ui/contexts/AudioContext';
import { formatAssistantStatusLine } from '@dadei/ui/lib/assistant/voice/labels/commandToolLabels';
import {
  typewriterDelayBeforeChar,
  typewriterRevealStep,
} from '@dadei/ui/lib/assistant/voice/ui/typewriterTiming';
import {
  BUBBLE_LAYOUT_TRANSITION,
  BUBBLE_PRESENCE_TRANSITION,
  CAPTURE_RELEASE_DEPRESS_Y,
  CAPTURE_RELEASE_MS,
  CAPTURE_RELEASE_SCALE,
  DOCK_BREATHE_DURATION_S,
  DOCK_BREATHE_SCALE,
  DOCK_POP_ORIGIN_BLUR_PX,
  DOCK_POP_ORIGIN_SCALE,
  DOCK_POP_ORIGIN_Y,
  DOCK_POP_SPRING,
  DOCK_SLOT_COLLAPSE_MS,
  DOCK_TO_STACK_LAYOUT_TRANSITION,
  TURN_SPLIT_ASSISTANT_ORIGIN_Y,
  TURN_SPLIT_SPRING,
  TURN_SPLIT_USER_PUSH_PX,
  dockGlowFromMicLevel,
  hasVisibleAssistantContent,
  isUserCaptureLive,
  shouldShowLiveUserBubble,
  userBubblePhase,
  userBubblePlacement,
} from '@dadei/ui/lib/assistant/voice/ui/commandBubbleMotion';
import { VOICE_EASE } from '@dadei/ui/lib/assistant/voice/constants';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import type { CommandState } from '@dadei/ui/types/command.types';

const STATUS_ELLIPSIS_CYCLE_MS = 480;
const STACK_EDGE_FADE_PX = 28;
const STACK_SCROLL_EDGE_EPS = 2;
const EMERALD = '0,204,106';
/** Command-mode dock chrome — aligned with MicrophoneButton MIC_GLASS.blue */
const COMMAND_SKY = '14,165,233';
const COMMAND_BLUE = '37,99,235';

type BubblePhase = 'thought' | 'settling' | 'settled';

const cardSettled: CSSProperties = {
  backdropFilter: 'blur(24px) saturate(135%)',
  WebkitBackdropFilter: 'blur(24px) saturate(135%)',
  background: 'linear-gradient(180deg, rgba(26,26,30,0.60) 0%, rgba(15,15,18,0.68) 100%)',
  border: '1px solid rgba(255,255,255,0.07)',
  boxShadow: [
    'inset 0 1px 0 0 rgba(255,255,255,0.07)',
    '0 1px 2px rgba(0,0,0,0.35)',
    '0 24px 48px -30px rgba(0,0,0,0.78)',
  ].join(', '),
};

const cardCaptureLive: CSSProperties = {
  backdropFilter: 'blur(26px) saturate(150%)',
  WebkitBackdropFilter: 'blur(26px) saturate(150%)',
  background:
    'linear-gradient(152deg, rgba(37,99,235,0.22) 0%, rgba(14,165,233,0.14) 42%, rgba(15,18,28,0.66) 100%)',
  border: `1px solid rgba(${COMMAND_SKY},0.30)`,
  boxShadow: [
    'inset 0 1px 0 0 rgba(255,255,255,0.11)',
    `inset 0 -22px 44px -34px rgba(${COMMAND_BLUE},0.20)`,
    `0 0 28px rgba(${COMMAND_BLUE},0.24)`,
    '0 1px 2px rgba(0,0,0,0.4)',
    '0 28px 56px -30px rgba(0,0,0,0.8)',
  ].join(', '),
};

const cardAssistantBusy: CSSProperties = {
  ...cardSettled,
  border: '1px solid rgba(96,165,250,0.14)',
  boxShadow: [
    'inset 0 1px 0 0 rgba(255,255,255,0.08)',
    'inset 0 -16px 36px -28px rgba(59,130,246,0.10)',
    '0 1px 2px rgba(0,0,0,0.35)',
    '0 24px 48px -30px rgba(0,0,0,0.78)',
  ].join(', '),
};

function cardStyleFor(
  role: 'user' | 'assistant',
  phase: BubblePhase,
  assistantStatus: AssistantBubbleStatus,
  captureLive: boolean,
): CSSProperties {
  if (role === 'assistant') {
    if (assistantStatus === 'pending' || assistantStatus === 'streaming') return cardAssistantBusy;
    return cardSettled;
  }
  if (captureLive) return cardCaptureLive;
  return cardSettled;
}

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

function SpeakerMark({
  role,
  live,
  reduce,
  commandState,
}: {
  role: 'user' | 'assistant';
  live: boolean;
  reduce: boolean;
  commandState?: CommandState;
}) {
  const isAssistant = role === 'assistant';
  const captureAccent = live && !isAssistant;
  const brandAccent = isAssistant;
  const accentRgb = captureAccent ? COMMAND_SKY : EMERALD;
  const dotColor = captureAccent
    ? `rgb(${COMMAND_SKY})`
    : brandAccent
      ? `rgb(${EMERALD})`
      : 'rgba(244,244,245,0.40)';
  const showPulse = (captureAccent || brandAccent) && !reduce;

  const userLabel =
    live && commandState === 'follow_up'
      ? 'follow-up'
      : live
        ? 'listening'
        : 'you';

  return (
    <span className="flex items-center gap-2">
      <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
        {showPulse ? (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ background: `rgba(${accentRgb},0.45)` }}
            animate={{ scale: [1, 2.8], opacity: [0.4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        ) : null}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: dotColor,
            boxShadow:
              captureAccent || brandAccent
                ? `0 0 6px rgba(${accentRgb},0.45)`
                : undefined,
          }}
        />
      </span>
      {isAssistant ? (
        <span className="font-brand text-[13px] leading-none tracking-[0.05em] text-zinc-200">
          dadei
        </span>
      ) : (
        <span className="font-secondary text-[10px] font-medium uppercase leading-none tracking-[0.22em] text-zinc-500">
          {userLabel}
        </span>
      )}
    </span>
  );
}

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
    timer.current = window.setTimeout(
      step,
      target.length ? typewriterDelayBeforeChar(target[0], target.length) : 0,
    );
    return () => {
      cancelled = true;
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [enabled, target, generation, onFirst, onDone]);
  return enabled ? out : target;
}

function Caret({ reduce, capture }: { reduce: boolean; capture?: boolean }) {
  return (
    <motion.span
      aria-hidden
      className={cn(
        'ml-px inline-block h-[1.05em] w-px translate-y-[2px] rounded-full align-middle',
        capture ? 'bg-sky-300' : 'bg-emerald-300',
      )}
      animate={reduce ? undefined : { opacity: [1, 0.12, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export interface CommandBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  phase: BubblePhase;
  floating?: boolean;
  interim?: boolean;
  commandState?: CommandState;
  micLevel?: number;
  placement?: 'dock' | 'stack' | null;
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
  commandState,
  micLevel = 0,
  assistantStatus = 'done',
  statusLine = null,
  typewriterEnabled = false,
  typewriterGeneration = 0,
  onTypewriterFirstChar,
  onTypewriterComplete,
  placement = null,
  dockPopSeq = 0,
}: CommandBubbleProps & { dockPopSeq?: number }) {
  const reduce = useReducedMotion();
  const isAssistant = role === 'assistant';
  const captureLive = isUserCaptureLive(placement ?? (floating ? 'dock' : 'stack'), phase);
  const live = !isAssistant && captureLive;
  const target = text.trim();

  const useTw = isAssistant && typewriterEnabled && assistantStatus === 'revealing';
  const typed = useTypewriterText(
    target,
    useTw,
    typewriterGeneration,
    onTypewriterFirstChar,
    onTypewriterComplete,
  );
  const visible = useTw ? typed : target;

  const showStatus =
    isAssistant &&
    !target.length &&
    (assistantStatus === 'pending' || assistantStatus === 'streaming');
  const statusForDisplay = statusLine?.trim() || (showStatus ? 'Thinking' : null);
  const listeningEmpty = live && !visible.length && !interim;
  const showBody = showStatus || visible.length > 0 || listeningEmpty;

  const cardStyle = cardStyleFor(role, phase, assistantStatus, captureLive);
  const dockGlow = captureLive ? dockGlowFromMicLevel(micLevel) : 0;
  const isDepressing = !isAssistant && phase === 'settling';
  const justPopped = captureLive && dockPopSeq > 0;

  return (
    <motion.div
      layout
      className="relative w-full min-w-0 shrink-0"
      initial={false}
      animate={{
        y: isDepressing ? [0, CAPTURE_RELEASE_DEPRESS_Y, 0] : 0,
        scale:
          isDepressing
            ? [1, CAPTURE_RELEASE_SCALE, 1]
            : captureLive && !reduce
              ? DOCK_BREATHE_SCALE
              : 1,
      }}
      transition={
        isDepressing
          ? { duration: CAPTURE_RELEASE_MS, ease: VOICE_EASE }
          : captureLive && !reduce
            ? { duration: DOCK_BREATHE_DURATION_S, repeat: Infinity, ease: 'easeInOut' }
            : BUBBLE_LAYOUT_TRANSITION
      }
    >
      <motion.div
        layout
        className={cn('relative overflow-hidden', captureLive && 'shadow-2xl')}
        initial={justPopped ? { borderRadius: 999 } : false}
        animate={{ borderRadius: captureLive ? 20 : 14 }}
        transition={{ duration: isDepressing ? CAPTURE_RELEASE_MS : justPopped ? 0.52 : 0.45, ease: VOICE_EASE }}
        style={cardStyle}
      >
        {dockGlow > 0 ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-70"
            animate={{
              boxShadow: `0 0 ${32 + dockGlow * 52}px rgba(${COMMAND_BLUE},${dockGlow * 0.5})`,
            }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          />
        ) : null}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />

        {captureLive && !reduce ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background: `linear-gradient(to top, rgba(${COMMAND_BLUE},0.12), transparent)`,
            }}
            animate={{ opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}

        <div className="relative min-w-0 px-5 py-3.5 sm:px-6 sm:py-4">
          <SpeakerMark role={role} live={live} reduce={!!reduce} commandState={commandState} />

          {showBody ? (
            <div className="mt-2.5 min-w-0">
              {showStatus && statusForDisplay ? (
                <AssistantLoadingStatus line={statusForDisplay} />
              ) : listeningEmpty ? (
                <p className="font-primary text-[15px] leading-[1.6] text-zinc-600 sm:text-[16px]">
                  <Caret reduce={!!reduce} capture={captureLive} />
                </p>
              ) : (
                <p
                  className={cn(
                    'font-primary whitespace-pre-wrap text-[15px] leading-[1.6] wrap-anywhere sm:text-[16px]',
                    interim ? 'text-zinc-400' : 'text-zinc-100',
                  )}
                >
                  {visible}
                  {interim ? <Caret reduce={!!reduce} capture={captureLive} /> : null}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

function LiveUserBubbleSlot({
  liveTurnId,
  placement,
  state,
  userBubbleText,
  userCaptionInterim,
  micLevel,
  dockPopSeq,
  splitActive = false,
}: {
  liveTurnId: string;
  placement: 'dock' | 'stack';
  state: CommandState;
  userBubbleText: string;
  userCaptionInterim: boolean;
  micLevel: number;
  dockPopSeq: number;
  splitActive?: boolean;
}) {
  const reduce = useReducedMotion();
  const phase = userBubblePhase(state, placement);
  const isDock = placement === 'dock';
  const layoutTransition = isDock ? BUBBLE_LAYOUT_TRANSITION : DOCK_TO_STACK_LAYOUT_TRANSITION;

  const bubble = (
    <CommandBubble
      role="user"
      text={userBubbleText}
      phase={phase}
      floating={isDock}
      interim={userCaptionInterim}
      commandState={state}
      micLevel={micLevel}
      placement={placement}
      dockPopSeq={dockPopSeq}
    />
  );

  return (
    <motion.div
      layout
      layoutId={`cmd-user-${liveTurnId}`}
      className="w-full min-w-0"
      transition={layoutTransition}
      animate={{
        marginTop: splitActive && !isDock ? TURN_SPLIT_USER_PUSH_PX : 0,
      }}
    >
      {isDock && !reduce ? (
        <motion.div
          key={`dock-pop-${dockPopSeq}`}
          className="w-full min-w-0"
          initial={{
            opacity: 0,
            y: DOCK_POP_ORIGIN_Y,
            scale: DOCK_POP_ORIGIN_SCALE,
            filter: `blur(${DOCK_POP_ORIGIN_BLUR_PX}px)`,
          }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={DOCK_POP_SPRING}
        >
          {bubble}
        </motion.div>
      ) : (
        bubble
      )}
    </motion.div>
  );
}

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
    followUpDockPrimed,
    assistantBubbleAnchored,
    notifyAssistantRevealStarted,
    notifyAssistantRevealComplete,
  } = useCommand();

  const audioCtx = useContext(AudioContext);
  const micLevel = audioCtx?.micLevel ?? 0;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [edgeMask, setEdgeMask] = useState<CSSProperties | undefined>(undefined);
  const [twGen, setTwGen] = useState(0);
  const prevStatus = useRef(assistantBubbleStatus);
  const [dockPopSeq, setDockPopSeq] = useState(0);
  const [dockRetaining, setDockRetaining] = useState(false);
  const [turnSplitActive, setTurnSplitActive] = useState(false);
  const [assistantSplitGen, setAssistantSplitGen] = useState(0);
  const prevPlacementRef = useRef<ReturnType<typeof userBubblePlacement>>(null);
  const prevStateRef = useRef(state);
  const prevShowAssistantRef = useRef(false);

  const followUpListenOpen =
    state === 'follow_up' &&
    !userCaptionInterim &&
    !userBubbleText.trim() &&
    !!liveTurnId;

  const placement = userBubblePlacement(state, !!liveTurnId, {
    isInterim: userCaptionInterim,
    userText: userBubbleText,
    followUpListenOpen,
  });
  const showLiveUser =
    liveTurnId && placement && shouldShowLiveUserBubble(placement, userBubbleText, followUpListenOpen);
  const dockPlacement = placement === 'dock';
  const stackPlacement = placement === 'stack';

  const showVisibleAssistant = hasVisibleAssistantContent(
    assistantBubbleText,
    assistantStatusLine,
    assistantBubbleStatus,
    state,
    assistantBubbleAnchored,
  );

  const showDockPrime =
    followUpDockPrimed && (state === 'responding' || state === 'follow_up') && !dockPlacement;

  useEffect(() => {
    if (stackPlacement && prevPlacementRef.current === 'dock') {
      setDockRetaining(true);
      const t = window.setTimeout(() => setDockRetaining(false), DOCK_SLOT_COLLAPSE_MS * 1000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [stackPlacement, dockPlacement]);

  useEffect(() => {
    if (showVisibleAssistant && !prevShowAssistantRef.current) {
      setTurnSplitActive(true);
      setAssistantSplitGen((g) => g + 1);
    }
    if (!showVisibleAssistant) {
      setTurnSplitActive(false);
    }
    prevShowAssistantRef.current = showVisibleAssistant;
  }, [showVisibleAssistant]);

  useEffect(() => {
    const prevPlacement = prevPlacementRef.current;
    const prevState = prevStateRef.current;

    if (placement === 'dock' && state === 'listening' && prevPlacement !== 'dock') {
      setDockPopSeq((n) => n + 1);
    } else if (state === 'follow_up' && prevState === 'responding') {
      setDockPopSeq((n) => n + 1);
    }

    prevPlacementRef.current = placement;
    prevStateRef.current = state;
  }, [placement, state]);

  useEffect(() => {
    if (assistantBubbleStatus === 'revealing' && prevStatus.current !== 'revealing') {
      setTwGen((g) => g + 1);
    }
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
      el.scrollTo({ top: 0, behavior: 'smooth' });
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
  }, [
    bubbleHistory,
    liveTurnId,
    userBubbleText,
    assistantBubbleText,
    assistantStatusLine,
    assistantBubbleStatus,
    placement,
  ]);

  const historyNewestFirst = [...bubbleHistory].reverse();

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-visible">
      <LayoutGroup id="command-bubble-stack">
        <motion.div
          layout
          className="command-bubble-dock relative z-50 w-full shrink-0 px-1"
          animate={{
            opacity: dockPlacement || dockRetaining || showDockPrime ? 1 : 0,
            marginBottom: dockPlacement || dockRetaining || showDockPrime ? 6 : 0,
          }}
          transition={{ duration: DOCK_SLOT_COLLAPSE_MS, ease: VOICE_EASE }}
        >
          {showDockPrime ? (
            <motion.div
              aria-hidden
              className="mx-auto h-2 w-2 rounded-full bg-sky-400/70 shadow-[0_0_20px_rgba(56,189,248,0.45)]"
              animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.85, 1.15, 0.85] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
          {showLiveUser && dockPlacement && liveTurnId ? (
            <LiveUserBubbleSlot
              liveTurnId={liveTurnId}
              placement="dock"
              state={state}
              userBubbleText={userBubbleText}
              userCaptionInterim={userCaptionInterim}
              micLevel={micLevel}
              dockPopSeq={dockPopSeq}
            />
          ) : null}
        </motion.div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={edgeMask ?? undefined}>
          <div
            ref={scrollRef}
            className="h-full min-h-0 overflow-y-auto overscroll-contain scroll-smooth px-1 py-2 [scrollbar-color:rgba(161,161,170,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/45"
          >
            <div className="mx-auto flex w-full flex-col gap-3">
              {liveTurnId && (showVisibleAssistant || (showLiveUser && stackPlacement)) ? (
                <motion.div
                  layout
                  className="flex w-full flex-col gap-3"
                  transition={TURN_SPLIT_SPRING}
                >
                  {showVisibleAssistant ? (
                    <motion.div
                      key={`split-asst-${liveTurnId}-${assistantSplitGen}`}
                      layout
                      layoutId={`cmd-asst-${liveTurnId}`}
                      className="relative z-10 w-full min-w-0"
                      initial={{ opacity: 0, y: TURN_SPLIT_ASSISTANT_ORIGIN_Y, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={TURN_SPLIT_SPRING}
                    >
                      <CommandBubble
                        role="assistant"
                        text={assistantBubbleText}
                        phase="thought"
                        assistantStatus={assistantBubbleStatus}
                        statusLine={assistantStatusLine}
                        commandState={state}
                        placement="stack"
                        typewriterEnabled={assistantBubbleStatus === 'revealing'}
                        typewriterGeneration={twGen}
                        onTypewriterFirstChar={notifyAssistantRevealStarted}
                        onTypewriterComplete={notifyAssistantRevealComplete}
                      />
                    </motion.div>
                  ) : null}

                  {showLiveUser && stackPlacement ? (
                    <LiveUserBubbleSlot
                      liveTurnId={liveTurnId}
                      placement="stack"
                      state={state}
                      userBubbleText={userBubbleText}
                      userCaptionInterim={userCaptionInterim}
                      micLevel={micLevel}
                      dockPopSeq={dockPopSeq}
                      splitActive={turnSplitActive}
                    />
                  ) : null}
                </motion.div>
              ) : null}

              {historyNewestFirst.map((turn) => (
                <div key={turn.id} className="flex w-full flex-col gap-3">
                  {turn.assistantText?.trim() ? (
                    <motion.div
                      layout
                      layoutId={`cmd-asst-${turn.id}`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={BUBBLE_PRESENCE_TRANSITION}
                    >
                      <CommandBubble
                        role="assistant"
                        text={turn.assistantText}
                        phase="settled"
                        assistantStatus="done"
                        placement="stack"
                      />
                    </motion.div>
                  ) : null}
                  {turn.userText?.trim() ? (
                    <motion.div layout layoutId={`cmd-user-${turn.id}`}>
                      <CommandBubble
                        role="user"
                        text={turn.userText}
                        phase="settled"
                        placement="stack"
                      />
                    </motion.div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}
