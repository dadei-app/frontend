import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import axios from 'axios';
import {
  isAbortError,
  streamCommandFromText,
  type CommandSSEEvent,
} from '@dadei/ui/lib/api/command';
import { serviceApi } from '@dadei/ui/lib/api/service';
import { getRealtimeSessionToken } from '@dadei/ui/lib/realtimeClient';
import { subscribeRealtimeMessages } from '@dadei/ui/lib/realtimeClient';
import {
  isInstructionalTranscriptBleed,
  sanitizeCommandTranscript,
} from '@dadei/ui/lib/commandTranscriptSanitize';
import {
  normalizeTranscriptForWake,
  normalizeVisibleCommandText,
  transcriptStartsWithWakeCommand,
} from '@dadei/ui/lib/wakeWordDetection';
import {
  CLAIM_HOLD_SECONDS,
  CLAIM_RENEW_BEFORE_EXPIRE_MS,
  computeFollowUpMs,
} from '@dadei/ui/lib/voice/voiceConstants';
import { commandToolLabel } from '@dadei/ui/lib/commandToolLabels';
import { isSessionEndUtterance } from '@dadei/ui/lib/voice/sessionEndDetection';
import { subscribeVoiceSpeechActivity } from '@dadei/ui/lib/voice/voiceSessionActivity';

const ASSISTANT_STATUS_THINKING = 'Thinking…';

export type CommandState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'follow_up'
  | 'locked';

export type AssistantBubbleStatus = 'pending' | 'streaming' | 'done';

export interface CommandTurnHistory {
  id: string;
  userText: string;
  assistantText: string;
}

interface CommandContextValue {
  state: CommandState;
  userBubbleText: string;
  assistantBubbleText: string;
  assistantBubbleStatus: AssistantBubbleStatus;
  /** Single in-bubble status while processing (Thinking… / current tool); cleared when text streams. */
  assistantStatusLine: string | null;
  bubbleHistory: CommandTurnHistory[];
  cancel: () => void;
  /** Manual command start without wake word (idle → listening). */
  startListening: () => void;
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined);

/** Release wake-only capture if user never continues with a command. */
const WAKE_FALSE_POSITIVE_MS = 12_000;
/** Minimum interim length before arming a follow-up (filters ASR noise). */
const MIN_FOLLOW_UP_INTERIM_CHARS = 4;
const INTERIM_SHRINK_GUARD_RATIO = 0.7;
const VOICE_DEBUG_STORAGE_KEY = 'dadei.voice.debug';

function formatToolSummarySnippet(summary: string, ok: boolean): string {
  if (!summary.trim()) return ok ? 'Done.' : 'Something went wrong.';
  try {
    const parsed = JSON.parse(summary) as Record<string, unknown>;
    if (!ok) {
      const err = parsed.error;
      return typeof err === 'string' && err.trim() ? err.trim() : 'Something went wrong.';
    }
    const data =
      parsed.data && typeof parsed.data === 'object'
        ? (parsed.data as Record<string, unknown>)
        : parsed;
    const current =
      data.current && typeof data.current === 'object'
        ? (data.current as Record<string, unknown>)
        : null;
    if (current && typeof current.temperature_2m === 'number') {
      const cond = typeof data.condition === 'string' ? data.condition.trim() : '';
      const temp = `About ${Math.round(current.temperature_2m)}°`;
      return cond ? `${temp}, ${cond}.` : `${temp} right now.`;
    }
    const message = parsed.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  } catch {
    /* use raw summary */
  }
  const trimmed = summary.trim();
  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}…` : trimmed;
}

function cleanTranscript(raw: string): string {
  const cleaned = sanitizeCommandTranscript(raw);
  if (!cleaned || isInstructionalTranscriptBleed(cleaned)) return '';
  return cleaned;
}

/** Live caption: show command text; keep wake word visible until stripped on submit. */
function bubbleCaptionText(text: string, fromFollowUp: boolean): string {
  const cleaned = cleanTranscript(text);
  if (!cleaned) return '';
  if (fromFollowUp) return cleaned.trim();
  const visible = normalizeVisibleCommandText(cleaned);
  return visible || normalizeTranscriptForWake(cleaned);
}

function normalizeInterimCaption(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function longestCommonPrefixLen(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let idx = 0;
  while (idx < max && a[idx] === b[idx]) idx += 1;
  return idx;
}

function isVoiceDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(VOICE_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export interface InterimCaptionState {
  utteranceId: number | null;
  interimSeq: number;
  caption: string;
}

export function stabilizeInterimCaptionState(
  prev: InterimCaptionState,
  rawCaption: string,
  utteranceId: number | null,
  interimSeq: number | null,
): InterimCaptionState {
  const candidate = rawCaption.trim();
  if (!candidate) return prev;
  const seq = typeof interimSeq === 'number' && Number.isFinite(interimSeq) ? interimSeq : null;
  const hasUtteranceId = typeof utteranceId === 'number' && Number.isFinite(utteranceId);
  const changedUtterance = hasUtteranceId && prev.utteranceId !== utteranceId;
  const base: InterimCaptionState = changedUtterance
    ? { utteranceId: utteranceId!, interimSeq: 0, caption: '' }
    : {
        utteranceId: hasUtteranceId ? utteranceId : prev.utteranceId,
        interimSeq: prev.interimSeq,
        caption: prev.caption,
      };

  if (seq != null && seq <= base.interimSeq) return base;
  const nextSeq = seq ?? base.interimSeq;
  const prevCaption = base.caption.trim();
  if (!prevCaption) return { ...base, interimSeq: nextSeq, caption: candidate };
  const prevNorm = normalizeInterimCaption(prevCaption);
  const nextNorm = normalizeInterimCaption(candidate);
  if (!nextNorm || nextNorm === prevNorm) return { ...base, interimSeq: nextSeq };
  if (nextNorm.startsWith(prevNorm)) return { ...base, interimSeq: nextSeq, caption: candidate };
  if (prevNorm.startsWith(nextNorm)) {
    const minAllowed = Math.max(4, Math.floor(prevNorm.length * INTERIM_SHRINK_GUARD_RATIO));
    if (nextNorm.length < minAllowed) return { ...base, interimSeq: nextSeq };
  } else {
    const lcp = longestCommonPrefixLen(prevNorm, nextNorm);
    const weakAlignment = lcp < Math.max(3, Math.floor(Math.min(prevNorm.length, nextNorm.length) * 0.45));
    if (weakAlignment && nextNorm.length < prevNorm.length) return { ...base, interimSeq: nextSeq };
  }
  return { ...base, interimSeq: nextSeq, caption: candidate };
}

export function CommandProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const {
    isConnected,
    isAssistantMode,
    isAssistantOwner,
    assistantModeExpiresAt,
  } = useService();

  const [state, setState] = useState<CommandState>('idle');
  const [userBubbleText, setUserBubbleText] = useState('');
  const [assistantBubbleText, setAssistantBubbleText] = useState('');
  const [assistantBubbleStatus, setAssistantBubbleStatus] =
    useState<AssistantBubbleStatus>('pending');
  const [assistantStatusLine, setAssistantStatusLine] = useState<string | null>(null);
  const [bubbleHistory, setBubbleHistory] = useState<CommandTurnHistory[]>([]);

  const stateRef = useRef(state);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const localClaimRef = useRef(false);
  const lastSubmittedTextRef = useRef<{ text: string; atMs: number } | null>(null);
  const lastWakeInterimRef = useRef('');
  const assistantBubbleTextRef = useRef('');
  const userBubbleTextRef = useRef('');
  const followUpCaptureRef = useRef(false);
  const sessionEndingRef = useRef(false);
  const pendingNewResponseRef = useRef(false);
  const commandStreamInFlightRef = useRef(false);
  const streamHadOutputRef = useRef(false);
  const lastToolBubbleSnippetRef = useRef('');
  const interimCaptionRef = useRef('');
  const interimSeqRef = useRef<number>(0);
  const interimUtteranceIdRef = useRef<number | null>(null);

  const setAssistantBubbleTextSynced = useCallback(
    (value: string | ((prev: string) => string)) => {
      setAssistantBubbleText((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        assistantBubbleTextRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    assistantBubbleTextRef.current = assistantBubbleText;
  }, [assistantBubbleText]);

  useEffect(() => {
    userBubbleTextRef.current = userBubbleText;
  }, [userBubbleText]);

  const clearFollowUpTimer = useCallback(() => {
    if (followUpTimerRef.current != null) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
  }, []);

  const onFollowUpSpeechActivity = useCallback(() => {
    if (stateRef.current !== 'follow_up') return;
    clearFollowUpTimer();
  }, [clearFollowUpTimer]);

  const clearWakeTimeout = useCallback(() => {
    if (wakeTimeoutRef.current != null) {
      clearTimeout(wakeTimeoutRef.current);
      wakeTimeoutRef.current = null;
    }
  }, []);

  const abortActiveStream = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
  }, []);

  const releaseAssistantMode = useCallback(async (): Promise<boolean> => {
    const sessionToken = getRealtimeSessionToken();
    if (!sessionToken) return false;
    try {
      await serviceApi.releaseAssistantMode(sessionToken);
      localClaimRef.current = false;
      return true;
    } catch (error) {
      console.warn('[Command] Failed to release assistant mode', error);
      return false;
    }
  }, []);

  const startRequestActivity = useCallback(() => {
    setAssistantStatusLine(ASSISTANT_STATUS_THINKING);
  }, []);

  const resetLiveBubbles = useCallback(() => {
    followUpCaptureRef.current = false;
    pendingNewResponseRef.current = false;
    lastToolBubbleSnippetRef.current = '';
    setAssistantStatusLine(null);
    setUserBubbleText('');
    setAssistantBubbleTextSynced('');
    setAssistantBubbleStatus('pending');
  }, [setAssistantBubbleTextSynced]);

  const resetInterimCaptionState = useCallback(() => {
    interimCaptionRef.current = '';
    interimSeqRef.current = 0;
    interimUtteranceIdRef.current = null;
  }, []);

  const stableInterimCaption = useCallback(
    (rawCaption: string, utteranceId: number | null, interimSeq: number | null): string => {
      const prevCaption = interimCaptionRef.current;
      const next = stabilizeInterimCaptionState(
        {
          utteranceId: interimUtteranceIdRef.current,
          interimSeq: interimSeqRef.current,
          caption: interimCaptionRef.current,
        },
        rawCaption,
        utteranceId,
        interimSeq,
      );
      interimUtteranceIdRef.current = next.utteranceId;
      interimSeqRef.current = next.interimSeq;
      interimCaptionRef.current = next.caption;
      if (isVoiceDebugEnabled()) {
        const accepted = next.caption.trim() !== prevCaption.trim() || !prevCaption.trim();
        // eslint-disable-next-line no-console
        console.debug('[Voice][Interim]', {
          utteranceId: next.utteranceId,
          interimSeq: next.interimSeq,
          rawChars: rawCaption.trim().length,
          stableChars: next.caption.trim().length,
          accepted,
        });
      }
      return next.caption;
    },
    [],
  );

  const goIdle = useCallback(() => {
    clearFollowUpTimer();
    clearWakeTimeout();
    abortActiveStream();
    sessionEndingRef.current = false;
    lastSubmittedTextRef.current = null;
    resetInterimCaptionState();
    setBubbleHistory([]);
    setState('idle');
    resetLiveBubbles();
  }, [abortActiveStream, clearFollowUpTimer, clearWakeTimeout, resetInterimCaptionState, resetLiveBubbles]);

  const endSession = useCallback(() => {
    sessionEndingRef.current = true;
    clearFollowUpTimer();
    clearWakeTimeout();
    abortActiveStream();
    void (async () => {
      if (localClaimRef.current) {
        await releaseAssistantMode();
      }
      goIdle();
    })();
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    releaseAssistantMode,
  ]);

  const cancel = useCallback(() => {
    void (async () => {
      clearFollowUpTimer();
      clearWakeTimeout();
      abortActiveStream();
      if (localClaimRef.current) {
        await releaseAssistantMode();
      }
      goIdle();
    })();
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    releaseAssistantMode,
  ]);

  const claimAssistantMode = useCallback(async (): Promise<boolean> => {
    const sessionToken = getRealtimeSessionToken();
    if (!sessionToken) return false;
    try {
      await serviceApi.claimAssistantMode(sessionToken, CLAIM_HOLD_SECONDS);
      localClaimRef.current = true;
      return true;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setState('locked');
        resetLiveBubbles();
        return false;
      }
      console.warn('[Command] claim failed', e);
      return false;
    }
  }, [resetLiveBubbles]);

  const scheduleWakeFalsePositiveRelease = useCallback(() => {
    clearWakeTimeout();
    wakeTimeoutRef.current = setTimeout(() => {
      if (stateRef.current !== 'listening') return;
      void (async () => {
        await releaseAssistantMode();
        goIdle();
      })();
    }, WAKE_FALSE_POSITIVE_MS);
  }, [clearWakeTimeout, goIdle, releaseAssistantMode]);

  const clearWakeFalsePositiveIfCommandInProgress = useCallback((text: string) => {
    const cleaned = cleanTranscript(text);
    if (!cleaned) return;
    if (normalizeVisibleCommandText(cleaned).trim()) {
      clearWakeTimeout();
    }
  }, [clearWakeTimeout]);

  const scheduleFollowUpExpiry = useCallback((responseChars: number) => {
    clearFollowUpTimer();
    const ms = computeFollowUpMs(responseChars);
    followUpTimerRef.current = setTimeout(() => {
      void (async () => {
        await releaseAssistantMode();
        goIdle();
      })();
    }, ms);
  }, [clearFollowUpTimer, goIdle, releaseAssistantMode]);

  const startNewTurn = useCallback(() => {
    clearFollowUpTimer();
    clearWakeTimeout();
    resetLiveBubbles();
  }, [clearFollowUpTimer, clearWakeTimeout, resetLiveBubbles]);

  /** Claim assistant mode, enter listening; does not wipe in-progress caption text. */
  const armWakeListening = useCallback(async (): Promise<boolean> => {
    clearWakeTimeout();
    clearFollowUpTimer();
    followUpCaptureRef.current = false;
    pendingNewResponseRef.current = false;
    lastSubmittedTextRef.current = null;
    setAssistantBubbleTextSynced('');
    setAssistantBubbleStatus('pending');
    setAssistantStatusLine(null);

    const claimed = await claimAssistantMode();
    if (!claimed) return false;

    setState('listening');
    scheduleWakeFalsePositiveRelease();
    return true;
  }, [
    claimAssistantMode,
    clearFollowUpTimer,
    clearWakeTimeout,
    scheduleWakeFalsePositiveRelease,
    setAssistantBubbleTextSynced,
  ]);

  const startListening = useCallback(() => {
    if (stateRef.current !== 'idle') return;
    startNewTurn();
    void armWakeListening();
  }, [armWakeListening, startNewTurn]);

  const handleStreamEvent = useCallback(
    (ev: CommandSSEEvent) => {
      switch (ev.type) {
        case 'transcript':
          break;
        case 'token':
          streamHadOutputRef.current = true;
          setState((s) => (s === 'thinking' ? 'responding' : s));
          setAssistantBubbleStatus('streaming');
          setAssistantStatusLine(null);
          setAssistantBubbleTextSynced((prev) => {
            if (pendingNewResponseRef.current) {
              pendingNewResponseRef.current = false;
              return ev.text;
            }
            return prev + ev.text;
          });
          break;
        case 'tool_call': {
          streamHadOutputRef.current = true;
          setState((s) => (s === 'thinking' ? 'responding' : s));
          setAssistantBubbleStatus('streaming');
          pendingNewResponseRef.current = false;
          const label = commandToolLabel(ev.tool);
          setAssistantStatusLine(label ? `${label}…` : ASSISTANT_STATUS_THINKING);
          break;
        }
        case 'tool_result':
          if (ev.summary) {
            streamHadOutputRef.current = true;
            const snippet = formatToolSummarySnippet(ev.summary, ev.ok);
            lastToolBubbleSnippetRef.current = snippet;
            if (!ev.ok) {
              setAssistantStatusLine(null);
              setAssistantBubbleTextSynced((prev) => (prev.trim() ? prev : snippet));
            }
            setAssistantBubbleStatus(ev.ok ? 'streaming' : 'done');
            setState((s) => (s === 'thinking' ? 'responding' : s));
          }
          break;
        case 'error':
          streamHadOutputRef.current = true;
          setAssistantStatusLine(null);
          setAssistantBubbleTextSynced(ev.message);
          setAssistantBubbleStatus('done');
          setState('follow_up');
          scheduleFollowUpExpiry(ev.message.length);
          break;
        case 'session_end':
          setAssistantBubbleStatus('done');
          endSession();
          break;
        case 'done':
          if (stateRef.current === 'idle' || sessionEndingRef.current) break;
          followUpCaptureRef.current = false;
          pendingNewResponseRef.current = false;
          setAssistantStatusLine(null);
          if (!assistantBubbleTextRef.current.trim()) {
            const fallback =
              lastToolBubbleSnippetRef.current.trim() || 'No response from Dadei. Try again.';
            setAssistantBubbleTextSynced(fallback);
            setAssistantBubbleStatus('done');
            setState('follow_up');
            scheduleFollowUpExpiry(fallback.length);
            break;
          }
          setAssistantBubbleStatus('done');
          setState('follow_up');
          void claimAssistantMode();
          scheduleFollowUpExpiry(assistantBubbleTextRef.current.length);
          break;
        default:
          break;
      }
    },
    [claimAssistantMode, endSession, scheduleFollowUpExpiry, setAssistantBubbleTextSynced],
  );

  const submitVisibleCommandText = useCallback(
    (raw: string, fromFollowUp: boolean) => {
      const cleaned = cleanTranscript(raw);
      if (!cleaned) return;
      const visible = fromFollowUp ? cleaned.trim() : normalizeVisibleCommandText(cleaned);
      if (!visible) {
        if (!fromFollowUp && transcriptStartsWithWakeCommand(cleaned)) {
          // Wake-only final (e.g. just "assistant") should keep listening for the
          // rest of the command instead of tearing down assistant mode.
          if (stateRef.current !== 'listening') {
            setState('listening');
          }
          scheduleWakeFalsePositiveRelease();
        }
        return;
      }

      if (fromFollowUp && isSessionEndUtterance(visible)) {
        setUserBubbleText(visible);
        endSession();
        return;
      }

      const nowMs = Date.now();
      const last = lastSubmittedTextRef.current;
      if (last && last.text === visible && nowMs - last.atMs < 1500) return;
      if (commandStreamInFlightRef.current) return;
      lastSubmittedTextRef.current = { text: visible, atMs: nowMs };

      clearWakeTimeout();
      clearFollowUpTimer();
      followUpCaptureRef.current = false;
      resetInterimCaptionState();
      streamHadOutputRef.current = false;
      lastToolBubbleSnippetRef.current = '';
      setAssistantBubbleTextSynced('');
      setAssistantBubbleStatus('pending');
      pendingNewResponseRef.current = true;
      startRequestActivity();
      setUserBubbleText(visible);
      setState('thinking');

      void (async () => {
        const claimed = await claimAssistantMode();
        if (!claimed) {
          const msg = fromFollowUp
            ? 'Could not keep assistant mode for follow-up'
            : 'Could not claim assistant mode';
          setAssistantBubbleTextSynced(msg);
          setAssistantBubbleStatus('done');
          setState(fromFollowUp ? 'follow_up' : 'idle');
          if (fromFollowUp) scheduleFollowUpExpiry(0);
          return;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
          setAssistantBubbleTextSynced('Not authenticated');
          setAssistantBubbleStatus('done');
          setState('follow_up');
          scheduleFollowUpExpiry(0);
          return;
        }

        if (!isConnected || !getRealtimeSessionToken()) {
          setAssistantBubbleTextSynced('Not connected to the assistant service yet');
          setAssistantBubbleStatus('done');
          setState('follow_up');
          scheduleFollowUpExpiry(0);
          return;
        }

        commandStreamInFlightRef.current = true;
        abortActiveStream();
        const abortController = new AbortController();
        streamAbortRef.current = abortController;

        try {
          let sawDone = false;
          for await (const ev of streamCommandFromText(visible, accessToken, {
            signal: abortController.signal,
          })) {
            if (ev.type === 'error' && abortController.signal.aborted) continue;
            if (ev.type === 'done') sawDone = true;
            handleStreamEvent(ev);
          }
          if (
            !sawDone &&
            !abortController.signal.aborted &&
            (stateRef.current === 'responding' || stateRef.current === 'thinking')
          ) {
            handleStreamEvent({ type: 'done' });
          }
        } catch (e) {
          if (isAbortError(e) || abortController.signal.aborted) {
            if (
              stateRef.current === 'thinking' &&
              !streamHadOutputRef.current &&
              !assistantBubbleTextRef.current.trim()
            ) {
              setAssistantBubbleTextSynced('Request cancelled');
              setAssistantBubbleStatus('done');
              setState('follow_up');
              scheduleFollowUpExpiry(0);
            }
            return;
          }
          const message = e instanceof Error ? e.message : 'Command failed';
          streamHadOutputRef.current = true;
          setAssistantBubbleTextSynced(message);
          setAssistantBubbleStatus('done');
          setState('follow_up');
          scheduleFollowUpExpiry(message.length);
        } finally {
          streamAbortRef.current = null;
          commandStreamInFlightRef.current = false;
        }
      })();
    },
    [
      abortActiveStream,
      claimAssistantMode,
      clearFollowUpTimer,
      endSession,
      getAccessToken,
      goIdle,
      handleStreamEvent,
      isConnected,
      releaseAssistantMode,
      resetInterimCaptionState,
      scheduleFollowUpExpiry,
      setAssistantBubbleTextSynced,
      startNewTurn,
      startRequestActivity,
    ],
  );

  useEffect(() => {
    const off = subscribeRealtimeMessages((msg) => {
      const current = stateRef.current;

      if (msg.event === 'command_transcript_interim') {
        if (current === 'thinking' || current === 'responding') return;
        const text = cleanTranscript(typeof msg.text === 'string' ? msg.text : '');
        if (!text) return;

        if (current === 'idle' && transcriptStartsWithWakeCommand(text)) {
          lastWakeInterimRef.current = text;
          void (async () => {
            const armed = await armWakeListening();
            if (!armed) return;
            const caption = bubbleCaptionText(text, false);
            if (caption) setUserBubbleText(caption);
          })();
          return;
        }

        if (current === 'listening') {
          clearWakeFalsePositiveIfCommandInProgress(text);
          const caption = bubbleCaptionText(text, followUpCaptureRef.current);
          const utteranceId =
            typeof msg.utterance_id === 'number' && Number.isFinite(msg.utterance_id)
              ? msg.utterance_id
              : null;
          const interimSeq =
            typeof msg.interim_seq === 'number' && Number.isFinite(msg.interim_seq)
              ? msg.interim_seq
              : null;
          const stableCaption = caption
            ? stableInterimCaption(caption, utteranceId, interimSeq)
            : '';
          if (stableCaption) setUserBubbleText(stableCaption);
          return;
        }

        if (current === 'follow_up') {
          if (commandStreamInFlightRef.current) return;
          const visible = text.trim();
          if (visible.length < MIN_FOLLOW_UP_INTERIM_CHARS) return;
          onFollowUpSpeechActivity();
          followUpCaptureRef.current = true;
          setUserBubbleText(visible);
        }
        return;
      }

      if (msg.event === 'command_transcript_done') {
        if (current !== 'listening') return;
        clearWakeTimeout();
        const caption = userBubbleTextRef.current.trim();
        const submitted =
          lastSubmittedTextRef.current != null &&
          Date.now() - lastSubmittedTextRef.current.atMs < 3_000;
        if (!caption && !submitted) {
          void (async () => {
            if (localClaimRef.current) await releaseAssistantMode();
            goIdle();
          })();
        }
        return;
      }

      if (msg.event === 'command_transcript_final') {
        if (current === 'thinking' || current === 'responding') return;
        const finalRaw = cleanTranscript(typeof msg.text === 'string' ? msg.text : '');
        const text = finalRaw || cleanTranscript(lastWakeInterimRef.current);
        resetInterimCaptionState();
        lastWakeInterimRef.current = '';

        if (current === 'idle') {
          if (!text.trim() || !transcriptStartsWithWakeCommand(text)) return;
          void (async () => {
            const armed = await armWakeListening();
            if (!armed) return;
            submitVisibleCommandText(text, false);
          })();
          return;
        }

        if (current === 'listening') {
          if (!text.trim()) return;
          const fromFollowUp = followUpCaptureRef.current;
          followUpCaptureRef.current = false;
          const caption = bubbleCaptionText(text, fromFollowUp);
          if (caption) setUserBubbleText(caption);
          submitVisibleCommandText(text, fromFollowUp);
          return;
        }

        if (current === 'follow_up') {
          if (commandStreamInFlightRef.current) return;
          const trimmed = text.trim();
          if (!trimmed) return;
          if (isSessionEndUtterance(trimmed)) {
            followUpCaptureRef.current = false;
            setUserBubbleText(trimmed);
            endSession();
            return;
          }
          if (!followUpCaptureRef.current) return;
          followUpCaptureRef.current = false;
          submitVisibleCommandText(text, true);
          return;
        }
      }
    });
    return off;
  }, [
    armWakeListening,
    clearWakeFalsePositiveIfCommandInProgress,
    clearWakeTimeout,
    endSession,
    goIdle,
    onFollowUpSpeechActivity,
    resetInterimCaptionState,
    releaseAssistantMode,
    scheduleWakeFalsePositiveRelease,
    stableInterimCaption,
    submitVisibleCommandText,
  ]);

  useEffect(() => subscribeVoiceSpeechActivity(onFollowUpSpeechActivity), [onFollowUpSpeechActivity]);

  useEffect(() => {
    if (isAssistantMode && !isAssistantOwner) {
      abortActiveStream();
      clearFollowUpTimer();
      clearWakeTimeout();
      setState('locked');
      setBubbleHistory([]);
      resetLiveBubbles();
      return;
    }
    if (stateRef.current === 'locked' && (!isAssistantMode || isAssistantOwner)) {
      goIdle();
    }
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    isAssistantMode,
    isAssistantOwner,
    resetLiveBubbles,
  ]);

  useEffect(() => {
    if (!localClaimRef.current || !assistantModeExpiresAt) return;
    const statesWithClaim: CommandState[] = [
      'listening',
      'thinking',
      'responding',
      'follow_up',
    ];
    if (!statesWithClaim.includes(state)) return;

    const tick = () => {
      const expiresAtMs = Date.parse(assistantModeExpiresAt);
      if (!Number.isFinite(expiresAtMs)) return;
      const remaining = expiresAtMs - Date.now();
      if (remaining > 0 && remaining < CLAIM_RENEW_BEFORE_EXPIRE_MS) {
        void claimAssistantMode();
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [assistantModeExpiresAt, claimAssistantMode, state]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancel]);

  useEffect(
    () => () => {
      clearFollowUpTimer();
      clearWakeTimeout();
      abortActiveStream();
    },
    [abortActiveStream, clearFollowUpTimer, clearWakeTimeout],
  );

  const value: CommandContextValue = {
    state,
    userBubbleText,
    assistantBubbleText,
    assistantBubbleStatus,
    assistantStatusLine,
    bubbleHistory,
    cancel,
    startListening,
  };

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export function useCommand(): CommandContextValue {
  const ctx = useContext(CommandContext);
  if (!ctx) {
    throw new Error('useCommand must be used within CommandProvider');
  }
  return ctx;
}

/** @deprecated Use CommandState */
export type CommandMode = CommandState;
