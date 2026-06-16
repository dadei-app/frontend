import { useContext, useEffect, useLayoutEffect, useRef, useState, useCallback, Fragment, type CSSProperties } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { AssistantBubbleStatus } from '@dadei/ui/contexts/CommandContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { AudioContext } from '@dadei/ui/contexts/AudioContext';
import { formatAssistantStatusLine } from '@dadei/ui/lib/assistant/voice/command/commandToolLabels';
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
  CAPTURE_CHROME_SETTLE_MS,
  COMMAND_BUBBLE_STACK_SPACING,
  COMMAND_DOCK_PLACEHOLDER,
  DOCK_POP_ORIGIN_BLUR_PX,
  DOCK_POP_ORIGIN_SCALE,
  DOCK_POP_SPRING,
  dockPopOriginY,
  ASSISTANT_REVEAL_DELAY_MS,
  DOCK_TO_STACK_LAYOUT_TRANSITION,
  STACK_SCROLL_EDGE_EPS,
  stackEdgeMaskStyle,
  TURN_SPLIT_ASSISTANT_ORIGIN_BLUR_PX,
  TURN_SPLIT_ASSISTANT_ORIGIN_ROTATE_X,
  TURN_SPLIT_ASSISTANT_ORIGIN_SCALE,
  TURN_SPLIT_ASSISTANT_ORIGIN_Y,
  TURN_SPLIT_SPRING,
  TURN_SPLIT_USER_PUSH_PX,
  TURN_SPLIT_USER_SCALE,
  TURN_SPLIT_USER_SPRING,
  commandBubbleStackStyle,
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
const BUBBLE_BODY_CLASS = 'font-primary text-[15px] leading-[1.6] sm:text-[16px]';
const BUBBLE_BODY_MIN_H = 'min-h-[1.6rem]';
/** Shared speaker line — one family/size so dadei and user labels read as a pair. */
const SPEAKER_MARK_CLASS =
  'font-primary text-[11px] font-medium leading-none tracking-[0.12em] lowercase';
/** Command-mode dock chrome — aligned with MicrophoneButton MIC_GLASS.blue */
const COMMAND_SKY = '14,165,233';

type BubblePhase = 'thought' | 'settling' | 'settled';

const userCardSettledChrome = {
  background: 'linear-gradient(180deg, rgba(26,26,30,0.97) 0%, rgba(15,15,18,0.98) 100%)',
  borderColor: 'rgba(255,255,255,0.07)',
  boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.35)',
} as const;

const userCardCaptureChrome = {
  background:
    'linear-gradient(152deg, rgba(22,30,48,0.97) 0%, rgba(14,18,28,0.98) 55%, rgba(12,14,22,0.99) 100%)',
  borderColor: `rgba(${COMMAND_SKY},0.32)`,
  boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.09), 0 1px 2px rgba(0,0,0,0.35)',
} as const;

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
  background: userCardCaptureChrome.background,
  border: `1px solid ${userCardCaptureChrome.borderColor}`,
  boxShadow: userCardCaptureChrome.boxShadow,
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

function applyStackEdgeMask(
  wrap: HTMLDivElement | null,
  scrollEl: HTMLDivElement | null,
): void {
  if (!wrap || !scrollEl) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollEl;
  if (scrollHeight <= clientHeight + STACK_SCROLL_EDGE_EPS) {
    wrap.style.maskImage = '';
    wrap.style.webkitMaskImage = '';
    return;
  }
  const mask = stackEdgeMaskStyle(
    scrollTop > STACK_SCROLL_EDGE_EPS,
    scrollTop + clientHeight < scrollHeight - STACK_SCROLL_EDGE_EPS,
    scrollHeight,
    clientHeight,
  );
  if (!mask) {
    wrap.style.maskImage = '';
    wrap.style.webkitMaskImage = '';
    return;
  }
  wrap.style.maskImage = mask.maskImage;
  wrap.style.webkitMaskImage = mask.WebkitMaskImage;
}

function SpeakerMark({
  role,
  live,
  reduce,
  commandState,
  commandBlue = false,
}: {
  role: 'user' | 'assistant';
  live: boolean;
  reduce: boolean;
  commandState?: CommandState;
  commandBlue?: boolean;
}) {
  const isAssistant = role === 'assistant';
  const captureAccent = live && !isAssistant;
  const showDot = (captureAccent || commandBlue) && !reduce;

  const userLabel =
    live && commandState === 'follow_up'
      ? 'follow-up'
      : live
        ? 'listening'
        : 'you';

  return (
    <span className={cn('flex items-center', showDot ? 'gap-2' : 'gap-0')}>
      {showDot ? (
        <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
          <AnimatePresence initial={false}>
            <motion.span
              key="live-dot"
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.55 }}
              transition={{ duration: CAPTURE_CHROME_SETTLE_MS, ease: VOICE_EASE }}
            >
              {captureAccent ? (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ background: `rgba(${COMMAND_SKY},0.45)` }}
                  animate={{ scale: [1, 2.8], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />
              ) : null}
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: `rgb(${COMMAND_SKY})`,
                  boxShadow: `0 0 6px rgba(${COMMAND_SKY},0.45)`,
                }}
              />
            </motion.span>
          </AnimatePresence>
        </span>
      ) : null}
      {isAssistant ? (
        <span className={cn(SPEAKER_MARK_CLASS, 'text-zinc-300')}>dadei</span>
      ) : (
        <span className={cn(SPEAKER_MARK_CLASS, 'text-zinc-500')}>{userLabel}</span>
      )}
    </span>
  );
}

function StatusSpinnerRing() {
  return (
    <motion.span
      className="box-border inline-block size-3.5 shrink-0 rounded-full border-2 border-zinc-600/70 border-t-sky-300/90"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      aria-hidden
    />
  );
}

function AnimatedStatusLine({ base }: { base: string }) {
  const [dotPhase, setDotPhase] = useState(1);
  useEffect(() => setDotPhase(1), [base]);
  useEffect(() => {
    const id = window.setInterval(
      () => setDotPhase((p) => (p % 3) + 1),
      STATUS_ELLIPSIS_CYCLE_MS,
    );
    return () => window.clearInterval(id);
  }, [base]);
  return <span className="text-zinc-400">{`${base}${'.'.repeat(dotPhase)}`}</span>;
}

function AssistantLoadingStatus({ line }: { line: string; commandBlue?: boolean }) {
  const statusBase = formatAssistantStatusLine(line);
  return (
    <span
      className="grid min-w-0 grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-3.5 font-primary text-[15px] leading-[1.55] sm:text-[16px] sm:leading-[1.6]"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="flex min-h-[1.55rem] items-center justify-center pt-0.5">
        <StatusSpinnerRing />
      </span>
      <span className="relative min-h-[1.55rem] min-w-0 py-0.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={statusBase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.28, ease: VOICE_EASE }}
            className="block min-w-0 whitespace-normal wrap-anywhere text-zinc-400"
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
  const dockPlaceholder =
    commandState === 'follow_up'
      ? COMMAND_DOCK_PLACEHOLDER.follow_up
      : COMMAND_DOCK_PLACEHOLDER.listening;
  const showBody = showStatus || visible.length > 0 || listeningEmpty;

  const commandBlueAccent =
    captureLive ||
    (isAssistant &&
      !!commandState &&
      (commandState === 'thinking' || commandState === 'responding'));

  const cardStyle = cardStyleFor(role, phase, assistantStatus, captureLive);
  const isDepressing = !isAssistant && phase === 'settling';
  const captureFading = isDepressing;
  const justPopped = captureLive && dockPopSeq > 0;
  const userChromeEase = VOICE_EASE;
  const userChromeDuration = captureLive ? 0.35 : CAPTURE_CHROME_SETTLE_MS;

  return (
    <motion.div
      layout={!isDepressing}
      className="relative w-full min-w-0 shrink-0"
      initial={false}
      animate={{
        y: isDepressing ? CAPTURE_RELEASE_DEPRESS_Y : 0,
        scale: 1,
      }}
      transition={
        isDepressing
          ? { duration: CAPTURE_RELEASE_MS, ease: VOICE_EASE }
          : BUBBLE_LAYOUT_TRANSITION
      }
    >
      <motion.div
        layout={!isDepressing}
        className="relative overflow-hidden"
        initial={false}
        animate={
          isAssistant
            ? {
                borderRadius: 14,
                scale: 1,
              }
            : {
                borderRadius: captureLive ? 20 : 14,
                scale: isDepressing ? CAPTURE_RELEASE_SCALE : 1,
                background: captureLive ? userCardCaptureChrome.background : userCardSettledChrome.background,
                borderColor: captureLive ? userCardCaptureChrome.borderColor : userCardSettledChrome.borderColor,
                boxShadow: captureLive ? userCardCaptureChrome.boxShadow : userCardSettledChrome.boxShadow,
              }
        }
        transition={{
          borderRadius: {
            duration: isDepressing ? CAPTURE_RELEASE_MS : justPopped ? 0.52 : userChromeDuration,
            ease: userChromeEase,
          },
          scale: { duration: isDepressing ? CAPTURE_RELEASE_MS : userChromeDuration, ease: userChromeEase },
          background: { duration: userChromeDuration, ease: userChromeEase },
          borderColor: { duration: userChromeDuration, ease: userChromeEase },
          boxShadow: { duration: userChromeDuration, ease: userChromeEase },
        }}
        style={
          isAssistant
            ? { ...cardStyle, borderWidth: 1, borderStyle: 'solid' }
            : { borderWidth: 1, borderStyle: 'solid' }
        }
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />

        <div
          className={cn(
            'relative min-w-0',
            showStatus ? 'px-6 py-5 sm:px-7 sm:py-5' : 'px-5 py-3.5 sm:px-6 sm:py-4',
          )}
        >
          <SpeakerMark
            role={role}
            live={live}
            reduce={!!reduce}
            commandState={commandState}
            commandBlue={commandBlueAccent}
          />

          {showBody ? (
            <div className={cn('min-w-0', showStatus ? 'mt-3.5' : 'mt-2.5')}>
              {showStatus && statusForDisplay ? (
                <AssistantLoadingStatus line={statusForDisplay} commandBlue={commandBlueAccent} />
              ) : listeningEmpty ? (
                <p className={cn(BUBBLE_BODY_CLASS, BUBBLE_BODY_MIN_H, 'text-zinc-500')}>
                  {dockPlaceholder}
                </p>
              ) : (
                <p
                  className={cn(
                    BUBBLE_BODY_CLASS,
                    BUBBLE_BODY_MIN_H,
                    'whitespace-pre-wrap wrap-anywhere',
                    interim ? 'text-zinc-400' : 'text-zinc-100',
                  )}
                >
                  {visible}
                  {interim && !captureLive ? <Caret reduce={!!reduce} capture={captureLive} /> : null}
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
}: {
  liveTurnId: string;
  placement: 'dock' | 'stack';
  state: CommandState;
  userBubbleText: string;
  userCaptionInterim: boolean;
  micLevel: number;
  dockPopSeq: number;
}) {
  const reduce = useReducedMotion();
  const prevPlacementRef = useRef(placement);
  const [settling, setSettling] = useState(false);
  const isDock = placement === 'dock';
  const layoutTransition = isDock ? BUBBLE_LAYOUT_TRANSITION : DOCK_TO_STACK_LAYOUT_TRANSITION;

  useEffect(() => {
    const prev = prevPlacementRef.current;
    prevPlacementRef.current = placement;
    if (prev === 'dock' && placement === 'stack') {
      setSettling(true);
      const t = window.setTimeout(() => setSettling(false), CAPTURE_RELEASE_MS * 1000);
      return () => window.clearTimeout(t);
    }
    if (placement === 'dock') setSettling(false);
    return undefined;
  }, [placement]);

  const phase = isDock ? 'thought' : settling ? 'settling' : userBubblePhase(state, placement);

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
      layout={isDock ? 'position' : false}
      layoutId={`cmd-user-${liveTurnId}`}
      className="w-full min-w-0"
      transition={layoutTransition}
    >
      {isDock && !reduce && dockPopSeq > 0 ? (
        <motion.div
          key={`dock-pop-${dockPopSeq}`}
          className="w-full min-w-0"
          style={{ transformOrigin: '50% 0%' }}
          initial={{
            opacity: 0,
            y: dockPopOriginY(),
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
    assistantBubbleAnchored,
    notifyAssistantRevealStarted,
    notifyAssistantRevealComplete,
  } = useCommand();

  const audioCtx = useContext(AudioContext);
  const micLevel = audioCtx?.micLevel ?? 0;
  const reduce = useReducedMotion();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const maskWrapRef = useRef<HTMLDivElement | null>(null);
  const scrollMetricsRef = useRef({ height: 0, top: 0, pinnedTop: true });
  const [twGen, setTwGen] = useState(0);
  const prevStatus = useRef(assistantBubbleStatus);
  const [dockPopSeq, setDockPopSeq] = useState(0);
  const [assistantStackReady, setAssistantStackReady] = useState(false);
  const prevPlacementRef = useRef<ReturnType<typeof userBubblePlacement>>(null);
  const prevStateRef = useRef(state);

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

  const showAssistantInStack = showVisibleAssistant && assistantStackReady;
  const useSplitSpawn =
    showAssistantInStack &&
    state === 'responding' &&
    assistantBubbleText.trim().length > 0;

  const splitNudgeRef = useRef(false);
  const [splitUserNudge, setSplitUserNudge] = useState(false);

  useEffect(() => {
    if (useSplitSpawn && !splitNudgeRef.current) {
      splitNudgeRef.current = true;
      setSplitUserNudge(true);
    }
    if (!useSplitSpawn) {
      splitNudgeRef.current = false;
      setSplitUserNudge(false);
    }
  }, [useSplitSpawn]);

  useEffect(() => {
    if (!stackPlacement || !showVisibleAssistant) {
      setAssistantStackReady(false);
      return undefined;
    }
    if (state === 'responding') {
      setAssistantStackReady(true);
      return undefined;
    }
    const t = window.setTimeout(() => setAssistantStackReady(true), ASSISTANT_REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [stackPlacement, showVisibleAssistant, state]);

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

  const historyNewestFirst = [...bubbleHistory].reverse();
  const pinnedStackTurn = state === 'follow_up' ? historyNewestFirst[0] : undefined;
  const scrollHistoryTurns = pinnedStackTurn ? historyNewestFirst.slice(1) : historyNewestFirst;

  const sync = useCallback(() => {
    applyStackEdgeMask(maskWrapRef.current, scrollRef.current);
  }, []);

  const anchorScrollAfterResize = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prev = scrollMetricsRef.current;
    const nextHeight = el.scrollHeight;
    const heightDelta = nextHeight - prev.height;

    if (heightDelta > 0 && prev.height > 0) {
      if (prev.pinnedTop) {
        el.scrollTop = 0;
      } else {
        el.scrollTop = prev.top + heightDelta;
      }
    }

    scrollMetricsRef.current = {
      height: el.scrollHeight,
      top: el.scrollTop,
      pinnedTop: el.scrollTop <= STACK_SCROLL_EDGE_EPS,
    };
    sync();
  }, [sync]);

  useLayoutEffect(() => {
    anchorScrollAfterResize();
  }, [
    anchorScrollAfterResize,
    bubbleHistory.length,
    liveTurnId,
    pinnedStackTurn?.id,
    showAssistantInStack,
    showLiveUser && stackPlacement,
    showLiveUser && dockPlacement,
    splitUserNudge,
  ]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      scrollMetricsRef.current = {
        height: el.scrollHeight,
        top: el.scrollTop,
        pinnedTop: el.scrollTop <= STACK_SCROLL_EDGE_EPS,
      };
      sync();
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => anchorScrollAfterResize());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [anchorScrollAfterResize, sync]);

  const renderHistoryTurn = (turn: (typeof bubbleHistory)[number], skipEnter = false) => (
    <Fragment key={turn.id}>
      {turn.assistantText?.trim() ? (
        <motion.div
          layoutId={`cmd-asst-${turn.id}`}
          className="w-full min-w-0"
          initial={skipEnter ? false : { opacity: 0, y: -8 }}
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
        <motion.div layoutId={`cmd-user-${turn.id}`} className="w-full min-w-0">
          <CommandBubble
            role="user"
            text={turn.userText}
            phase="settled"
            placement="stack"
          />
        </motion.div>
      ) : null}
    </Fragment>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-visible">
      <LayoutGroup id="command-bubble-stack">
        <div ref={maskWrapRef} className="flex h-full min-h-0 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            className="h-full min-h-0 overflow-y-auto overscroll-contain px-1 [overflow-anchor:none] [scrollbar-color:rgba(161,161,170,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/45"
            style={{
              paddingTop: COMMAND_BUBBLE_STACK_SPACING.scrollPaddingPx,
              paddingBottom: COMMAND_BUBBLE_STACK_SPACING.scrollPaddingPx,
            }}
          >
            <div className="mx-auto flex w-full flex-col" style={commandBubbleStackStyle()}>
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

              {pinnedStackTurn ? renderHistoryTurn(pinnedStackTurn, true) : null}

              {liveTurnId && showAssistantInStack ? (
                <motion.div
                  key={`asst-${liveTurnId}`}
                  layoutId={`cmd-asst-${liveTurnId}`}
                  className="relative z-10 w-full min-w-0"
                  style={{ transformPerspective: 900 }}
                  initial={
                    reduce
                      ? false
                      : useSplitSpawn
                        ? {
                            opacity: 0,
                            y: TURN_SPLIT_ASSISTANT_ORIGIN_Y,
                            scale: TURN_SPLIT_ASSISTANT_ORIGIN_SCALE,
                            filter: `blur(${TURN_SPLIT_ASSISTANT_ORIGIN_BLUR_PX}px)`,
                            rotateX: TURN_SPLIT_ASSISTANT_ORIGIN_ROTATE_X,
                          }
                        : { opacity: 0 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', rotateX: 0 }}
                  transition={
                    useSplitSpawn
                      ? TURN_SPLIT_SPRING
                      : { duration: 0.48, ease: VOICE_EASE }
                  }
                >
                  {useSplitSpawn && !reduce ? (
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute -bottom-2 left-1/2 z-0 h-px w-[72%] -translate-x-1/2 bg-gradient-to-r from-transparent via-sky-400/55 to-transparent"
                      initial={{ opacity: 0, scaleX: 0.2 }}
                      animate={{ opacity: [0, 0.9, 0], scaleX: [0.2, 1, 1] }}
                      transition={{ duration: 0.55, ease: VOICE_EASE, times: [0, 0.35, 1] }}
                    />
                  ) : null}
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

              {liveTurnId && showLiveUser && stackPlacement ? (
                <motion.div
                  className="w-full min-w-0"
                  animate={
                    reduce || !splitUserNudge
                      ? { y: 0, scale: 1 }
                      : { y: TURN_SPLIT_USER_PUSH_PX, scale: TURN_SPLIT_USER_SCALE }
                  }
                  transition={TURN_SPLIT_USER_SPRING}
                >
                  <LiveUserBubbleSlot
                    liveTurnId={liveTurnId}
                    placement="stack"
                    state={state}
                    userBubbleText={userBubbleText}
                    userCaptionInterim={userCaptionInterim}
                    micLevel={micLevel}
                    dockPopSeq={dockPopSeq}
                  />
                </motion.div>
              ) : null}

              {scrollHistoryTurns.map((turn) => renderHistoryTurn(turn))}
            </div>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}
