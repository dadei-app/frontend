import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import axios from 'axios';
import {
  isAbortError,
  streamCommandFromText,
  streamIntroductionFromText,
  type CommandSSEEvent,
} from '@dadei/ui/lib/workspace/api/command';
import { INTRODUCTION_KICKOFF_TEXT } from '@dadei/ui/lib/onboarding/introduction/constants';
import { serviceApi } from '@dadei/ui/lib/workspace/api/service';
import {
  getRealtimeClientId,
  getRealtimeSessionToken,
  sendRealtimeMessage,
  subscribeRealtimeMessages,
} from '@dadei/ui/lib/assistant/realtime/realtimeClient';
import {
  ERROR_CODES,
  formatCommandStreamError,
  formatToolResultUserMessage,
  formatWsTranscriptError,
  getUserErrorMessage,
} from '@dadei/ui/lib/platform/errors/userMessage';
import { isProposedToolSummary, proposedActionHumanLine } from '@dadei/ui/lib/workspace/display/actionDisplay';
import {
  isInstructionalTranscriptBleed,
  sanitizeCommandTranscript,
} from '@dadei/ui/lib/assistant/voice/wake/commandTranscriptSanitize';
import {
  liveCommandCaptionText,
  submitCommandText,
} from '@dadei/ui/lib/assistant/voice/wake/commandCaption';
import { normalizeVisibleCommandText, transcriptStartsWithWakeCommand } from '@dadei/ui/lib/assistant/voice/wake/wakeWordDetection';
import {
  CLAIM_HOLD_SECONDS,
  CLAIM_RENEW_BEFORE_EXPIRE_MS,
  computeFollowUpMs,
  FOLLOW_UP_MIN_MS,
} from '@dadei/ui/lib/assistant/voice/constants';
import {
  commandToolStatusLabel,
  formatAssistantStatusLine,
} from '@dadei/ui/lib/assistant/voice/labels/commandToolLabels';
import { isSessionEndUtterance } from '@dadei/ui/lib/assistant/voice/session/sessionEndDetection';
import {
  notifyCommandCaptureCommit,
  subscribeVoiceSpeechActivity,
} from '@dadei/ui/lib/assistant/voice/session/voiceSessionActivity';
import CommandBubble from '@dadei/ui/components/command/CommandBubble';
import { formatForUser } from '@dadei/ui/lib/platform/shared/time';
import { COMMAND_PROCESSING_STATES } from '@dadei/ui/lib/assistant/voice/micAppearance';

const ASSISTANT_STATUS_THINKING = 'Thinking';

import type { AssistantBubbleStatus, CommandState } from '@dadei/ui/types/voice.types';

export type { AssistantBubbleStatus, CommandState } from '@dadei/ui/types/voice.types';

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
  /** Stable id for the in-flight user+assistant pair (shared with history on commit). */
  liveTurnId: string | null;
  /** Leave command mode and return to passive listening; service on/off unchanged. */
  cancelCommandMode: () => void;
  /** Abort in-flight transcription/response and re-open the mic in command mode. */
  cancelProcessing: () => void;
  /** Manual command start without wake word (idle → listening). */
  startListening: () => void;
  /** Introduction handoff: claim assistant mode and stream the canned opener. */
  beginIntroduction: () => Promise<boolean>;
  introductionModeActive: boolean;
  /** User finished speaking; mic spinner only until transcript arrives. */
  notifyCommandUtteranceEnded: () => void;
  /** First typewriter character of the final response (mic → follow-up listen). */
  notifyAssistantRevealStarted: () => void;
  /** Typewriter finished; start the 7s follow-up window. */
  notifyAssistantRevealComplete: () => void;
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined);

/** Release wake-only capture if user never continues with a command. */
const WAKE_FALSE_POSITIVE_MS = 12_000;
/** Minimum interim length before arming a follow-up (filters ASR noise). */
const MIN_FOLLOW_UP_INTERIM_CHARS = 4;
const INTERIM_SHRINK_GUARD_RATIO = 0.7;

function formatToolSummarySnippet(summary: string, ok: boolean): string {
  const toolErr = formatToolResultUserMessage(summary, ok);
  if (!ok && toolErr) return toolErr;
  if (!summary.trim()) return ok ? '' : ERROR_CODES.request_failed;
  try {
    const parsed = JSON.parse(summary) as Record<string, unknown>;
    if (!ok) {
      const err = parsed.error;
      return typeof err === 'string' && err.trim() ? err.trim() : 'Something went wrong.';
    }
    if (isProposedToolSummary(parsed)) {
      return '';
    }
    const message = parsed.message;
    if (typeof message === 'string' && message.trim()) {
      const trimmed = message.trim();
      if (trimmed.startsWith('{')) {
        try {
          const inner = JSON.parse(trimmed) as Record<string, unknown>;
          const proposedLine = proposedActionHumanLine(inner as Parameters<typeof proposedActionHumanLine>[0]);
          if (proposedLine) return proposedLine;
        } catch {
          /* fall through */
        }
      } else {
        return trimmed;
      }
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
      const units = typeof data.units === 'string' ? data.units.toLowerCase() : '';
      const c = units === 'imperial' ? Math.round(((current.temperature_2m as number) - 32) * (5 / 9)) : Math.round(current.temperature_2m);
      const f = units === 'imperial' ? Math.round(current.temperature_2m) : Math.round((current.temperature_2m as number) * (9 / 5) + 32);
      const temp = `About ${c}°C (${f}°F)`;
      return cond ? `${temp}, ${cond}.` : `${temp} right now.`;
    }
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length > 0) {
      const first = items[0] as Record<string, unknown>;
      const firstStart =
        first.start && typeof first.start === 'object'
          ? (first.start as Record<string, unknown>)
          : null;
      const title =
        typeof first.summary === 'string'
          ? first.summary.trim()
          : typeof first.title === 'string'
            ? first.title.trim()
            : typeof first.name === 'string'
              ? first.name.trim()
              : typeof first.id === 'string'
                ? first.id.trim()
                : '';
      const startIso =
        firstStart && typeof firstStart.dateTime === 'string'
          ? firstStart.dateTime
          : firstStart && typeof firstStart.date === 'string'
            ? firstStart.date
            : '';
      if (items.length === 1) {
        if (title && startIso) {
          const when = new Date(startIso);
          if (!Number.isNaN(when.getTime())) {
            const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            const timeLabel = formatForUser(when.toISOString(), userTz, {
              hour: 'numeric',
              minute: '2-digit',
            });
            return `Next event is ${title} at ${timeLabel}.`;
          }
        }
        return title ? `I found 1 item: ${title}.` : 'I found 1 item.';
      }
      if (title && startIso) {
        const when = new Date(startIso);
        if (!Number.isNaN(when.getTime())) {
          const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const timeLabel = formatForUser(when.toISOString(), userTz, {
            hour: 'numeric',
            minute: '2-digit',
          });
          return `I found ${items.length} events. Next is ${title} at ${timeLabel}.`;
        }
      }
      if (title) return `I found ${items.length} items. First is ${title}.`;
      return `I found ${items.length} items.`;
    }
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      const lat = data.latitude.toFixed(4);
      const lon = data.longitude.toFixed(4);
      return `You're near ${lat}, ${lon}.`;
    }
    const timezone = typeof data.timezone === 'string' ? data.timezone.trim() : '';
    const localIso = typeof data.local_iso === 'string' ? data.local_iso.trim() : '';
    if (timezone && localIso) {
      const parsedDate = new Date(localIso);
      if (!Number.isNaN(parsedDate.getTime())) {
        const timeLabel = formatForUser(parsedDate.toISOString(), timezone, {
          hour: 'numeric',
          minute: '2-digit',
        });
        return `It's currently ${timeLabel} in ${timezone}.`;
      }
      return `Current timezone is ${timezone}.`;
    }
    if (ok) return '';
  } catch {
    if (ok) return '';
  }
  const trimmed = summary.trim();
  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}…` : trimmed;
}

function cleanTranscript(raw: string): string {
  const cleaned = sanitizeCommandTranscript(raw);
  if (!cleaned || isInstructionalTranscriptBleed(cleaned)) return '';
  return cleaned;
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
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const { showToast } = useNotifications();
  const {
    isServiceEnabled,
    isConnected,
    isCommandMode,
    isCommandOwner,
    commandModeExpiresAt,
    syncCommandModeFromClaim,
  } = useService();
  const [introductionModeActive, setIntroductionModeActive] = useState(false);
  const introductionModeActiveRef = useRef(false);

  useEffect(() => {
    introductionModeActiveRef.current = introductionModeActive;
  }, [introductionModeActive]);

  const endIntroductionMode = useCallback(() => {
    if (!introductionModeActiveRef.current) return;
    introductionModeActiveRef.current = false;
    setIntroductionModeActive(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
  }, [queryClient]);

  const [state, setState] = useState<CommandState>('idle');
  const [userBubbleText, setUserBubbleText] = useState('');
  const [assistantBubbleText, setAssistantBubbleText] = useState('');
  const [assistantBubbleStatus, setAssistantBubbleStatus] =
    useState<AssistantBubbleStatus>('pending');
  const [assistantStatusLine, setAssistantStatusLine] = useState<string | null>(null);
  const [bubbleHistory, setBubbleHistory] = useState<CommandTurnHistory[]>([]);
  const [liveTurnId, setLiveTurnId] = useState<string | null>(null);

  const stateRef = useRef(state);
  const liveTurnIdRef = useRef<string | null>(null);
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
  const lastCommittedTurnRef = useRef('');
  const interimCaptionRef = useRef('');
  const interimSeqRef = useRef<number>(0);
  const interimUtteranceIdRef = useRef<number | null>(null);
  const utteranceEndNotifiedRef = useRef(false);
  /** True after local end-of-speech until transcript final is handled. */
  const awaitingTranscriptRef = useRef(false);
  const transcribeFromFollowUpRef = useRef(false);
  const responseRevealStartedRef = useRef(false);
  const revealCompleteHandledRef = useRef(false);
  /** Bumped on cancelProcessing so stale inference loops no-op. */
  const commandProcessingEpochRef = useRef(0);
  /** Epoch of the active /command/text SSE consumer; must match commandProcessingEpochRef. */
  const activeCommandStreamEpochRef = useRef(0);
  /** Drop the next WS final after cancel (server may still finish a discarded decode). */
  const suppressNextTranscriptFinalRef = useRef(false);
  const lastServerUtteranceIdRef = useRef<number | null>(null);

  const setAssistantBubbleTextSynced = useCallback(
    (value: string | ((prev: string) => string)) => {
      const next =
        typeof value === 'function' ? value(assistantBubbleTextRef.current) : value;
      assistantBubbleTextRef.current = next;
      setAssistantBubbleText(next);
    },
    [],
  );

  const setStateSynced = useCallback((next: CommandState | ((prev: CommandState) => CommandState)) => {
    const resolved =
      typeof next === 'function' ? next(stateRef.current) : next;
    stateRef.current = resolved;
    setState(resolved);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state === 'listening') {
      utteranceEndNotifiedRef.current = false;
      awaitingTranscriptRef.current = false;
      responseRevealStartedRef.current = false;
    }
    if (state === 'follow_up') {
      utteranceEndNotifiedRef.current = false;
      awaitingTranscriptRef.current = false;
    }
  }, [state]);

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

  const releaseCommandMode = useCallback(async (): Promise<boolean> => {
    const sessionToken = getRealtimeSessionToken();
    if (!sessionToken) return false;
    try {
      await serviceApi.releaseCommandMode(sessionToken);
      localClaimRef.current = false;
      return true;
    } catch (error) {
      console.warn('[Command] Failed to release assistant mode', error);
      return false;
    }
  }, []);

  const startRequestActivity = useCallback(() => {
    setAssistantStatusLine(formatAssistantStatusLine(ASSISTANT_STATUS_THINKING));
  }, []);

  const notifyCommandUtteranceEnded = useCallback(() => {
    if (utteranceEndNotifiedRef.current) return;
    const current = stateRef.current;
    if (current !== 'listening' && current !== 'follow_up') return;
    if (commandStreamInFlightRef.current) return;

    notifyCommandCaptureCommit();
    utteranceEndNotifiedRef.current = true;
    awaitingTranscriptRef.current = true;
    transcribeFromFollowUpRef.current = current === 'follow_up';
    clearWakeTimeout();
    clearFollowUpTimer();
    setState('transcribing');
  }, [clearFollowUpTimer, clearWakeTimeout]);

  const notifyAssistantRevealStarted = useCallback(() => {
    if (responseRevealStartedRef.current) return;
    responseRevealStartedRef.current = true;
    // Introduction: keep mic sealed while the canned opener types out — opening on
    // the first character was buffering ambient audio to the 20s decode cap.
    if (introductionModeActiveRef.current) return;
    setState('follow_up');
  }, []);

  const newTurnId = () => `turn-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  const assignLiveTurnId = useCallback(() => {
    const id = newTurnId();
    liveTurnIdRef.current = id;
    setLiveTurnId(id);
    return id;
  }, []);

  const clearLiveTurnId = useCallback(() => {
    liveTurnIdRef.current = null;
    setLiveTurnId(null);
  }, []);

  const commitLiveTurnToHistory = useCallback(() => {
    const user = userBubbleTextRef.current.trim();
    const assistant = assistantBubbleTextRef.current.trim();
    if (!assistant) return;
    const dedupeKey = `${user}::${assistant}`;
    if (lastCommittedTurnRef.current === dedupeKey) return;
    lastCommittedTurnRef.current = dedupeKey;
    const id = liveTurnIdRef.current ?? newTurnId();
    liveTurnIdRef.current = null;
    setLiveTurnId(null);
    setBubbleHistory((prev) => [...prev.slice(-7), { id, userText: user, assistantText: assistant }]);
  }, []);

  const resetLiveBubbles = useCallback(() => {
    followUpCaptureRef.current = false;
    pendingNewResponseRef.current = false;
    lastToolBubbleSnippetRef.current = '';
    clearLiveTurnId();
    setAssistantStatusLine(null);
    setUserBubbleText('');
    setAssistantBubbleTextSynced('');
    setAssistantBubbleStatus('pending');
  }, [clearLiveTurnId, setAssistantBubbleTextSynced]);

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
      const accepted = next.caption.trim() !== prevCaption.trim() || !prevCaption.trim();
      // eslint-disable-next-line no-console
      console.debug('[Voice][Interim]', {
        utteranceId: next.utteranceId,
        interimSeq: next.interimSeq,
        rawChars: rawCaption.trim().length,
        stableChars: next.caption.trim().length,
        accepted,
      });
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
    lastCommittedTurnRef.current = '';
    resetInterimCaptionState();
    setBubbleHistory([]);
    setState('idle');
    resetLiveBubbles();
  }, [abortActiveStream, clearFollowUpTimer, clearWakeTimeout, resetInterimCaptionState, resetLiveBubbles]);

  const endSession = useCallback(() => {
    endIntroductionMode();
    sessionEndingRef.current = true;
    clearFollowUpTimer();
    clearWakeTimeout();
    abortActiveStream();
    void (async () => {
      if (localClaimRef.current) {
        await releaseCommandMode();
      }
      goIdle();
    })();
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    endIntroductionMode,
    releaseCommandMode,
  ]);

  const cancelCommandMode = useCallback(() => {
    commandProcessingEpochRef.current += 1;
    suppressNextTranscriptFinalRef.current = false;
    endIntroductionMode();
    void (async () => {
      clearFollowUpTimer();
      clearWakeTimeout();
      abortActiveStream();
      if (localClaimRef.current) {
        await releaseCommandMode();
      }
      goIdle();
    })();
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    endIntroductionMode,
    releaseCommandMode,
  ]);

  const claimCommandMode = useCallback(async (): Promise<boolean> => {
    const sessionToken = getRealtimeSessionToken();
    if (!sessionToken) return false;
    try {
      const claimed = await serviceApi.claimCommandMode(sessionToken, CLAIM_HOLD_SECONDS);
      syncCommandModeFromClaim(claimed);
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
  }, [resetLiveBubbles, syncCommandModeFromClaim]);

  const scheduleWakeFalsePositiveRelease = useCallback(() => {
    clearWakeTimeout();
    wakeTimeoutRef.current = setTimeout(() => {
      if (stateRef.current !== 'listening') return;
      void (async () => {
        endIntroductionMode();
        await releaseCommandMode();
        goIdle();
      })();
    }, WAKE_FALSE_POSITIVE_MS);
  }, [clearWakeTimeout, endIntroductionMode, goIdle, releaseCommandMode]);

  const cancelProcessing = useCallback(() => {
    if (!COMMAND_PROCESSING_STATES.has(stateRef.current)) return;

    const inIntroduction = introductionModeActiveRef.current;
    commandProcessingEpochRef.current += 1;
    suppressNextTranscriptFinalRef.current = true;

    if (!inIntroduction) {
      endIntroductionMode();
    }
    abortActiveStream();
    clearFollowUpTimer();
    clearWakeTimeout();
    utteranceEndNotifiedRef.current = false;
    awaitingTranscriptRef.current = false;
    transcribeFromFollowUpRef.current = false;
    responseRevealStartedRef.current = false;
    revealCompleteHandledRef.current = false;
    followUpCaptureRef.current = false;
    pendingNewResponseRef.current = false;
    lastSubmittedTextRef.current = null;
    streamHadOutputRef.current = false;
    lastToolBubbleSnippetRef.current = '';
    resetInterimCaptionState();
    resetLiveBubbles();
    commandStreamInFlightRef.current = false;
    setState(inIntroduction ? 'follow_up' : 'listening');
    if (!inIntroduction) {
      scheduleWakeFalsePositiveRelease();
    }
    const clientId = getRealtimeClientId();
    sendRealtimeMessage({
      type: 'command_inference_cancel',
      ...(clientId ? { client_id: clientId } : {}),
    });
    sendRealtimeMessage({ type: 'command_audio_discard' });
    console.debug('[Voice][Cancel] cancelProcessing', {
      state: stateRef.current,
      epoch: commandProcessingEpochRef.current,
    });
  }, [
    clearFollowUpTimer,
    clearWakeTimeout,
    endIntroductionMode,
    resetInterimCaptionState,
    resetLiveBubbles,
    scheduleWakeFalsePositiveRelease,
  ]);

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
        if (introductionModeActiveRef.current) return;
        endIntroductionMode();
        await releaseCommandMode();
        goIdle();
      })();
    }, ms);
  }, [clearFollowUpTimer, endIntroductionMode, goIdle, releaseCommandMode]);

  const scheduleFollowUpAfterTypewriter = useCallback(() => {
    clearFollowUpTimer();
    followUpTimerRef.current = setTimeout(() => {
      void (async () => {
        endIntroductionMode();
        await releaseCommandMode();
        goIdle();
      })();
    }, FOLLOW_UP_MIN_MS);
  }, [clearFollowUpTimer, endIntroductionMode, goIdle, releaseCommandMode]);

  const notifyAssistantRevealComplete = useCallback(() => {
    if (revealCompleteHandledRef.current) return;
    if (stateRef.current === 'idle' || sessionEndingRef.current) return;
    const assistant = assistantBubbleTextRef.current.trim();
    if (!assistant) return;

    revealCompleteHandledRef.current = true;
    commitLiveTurnToHistory();
    setUserBubbleText('');
    setAssistantBubbleTextSynced('');
    setAssistantBubbleStatus('pending');
    setAssistantStatusLine(null);
    responseRevealStartedRef.current = false;
    followUpCaptureRef.current = false;
    void claimCommandMode();
    if (introductionModeActiveRef.current) {
      // Introduction stays active until inference ends the session — no follow-up idle timer.
      setState('follow_up');
    } else {
      scheduleFollowUpAfterTypewriter();
    }
  }, [
    claimCommandMode,
    commitLiveTurnToHistory,
    scheduleFollowUpAfterTypewriter,
    setAssistantBubbleTextSynced,
  ]);

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

    // Arm server capture before HTTP claim so in-flight PCM is promoted, not discarded.
    sendRealtimeMessage({ type: 'command_audio_wake' });

    const claimed = await claimCommandMode();
    if (!claimed) return false;

    setState('listening');
    scheduleWakeFalsePositiveRelease();
    return true;
  }, [
    claimCommandMode,
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
      if (activeCommandStreamEpochRef.current !== commandProcessingEpochRef.current) {
        return;
      }
      switch (ev.type) {
        case 'transcript':
          break;
        case 'token':
          streamHadOutputRef.current = true;
          setState((s) => (s === 'thinking' ? 'responding' : s));
          setAssistantBubbleStatus('streaming');
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
          setAssistantBubbleStatus('pending');
          const label = commandToolStatusLabel(ev.tool);
          setAssistantStatusLine(formatAssistantStatusLine(label || ASSISTANT_STATUS_THINKING));
          break;
        }
        case 'tool_result':
          if (ev.tool === 'assign_person_name' && ev.ok) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
          }
          if (ev.summary) {
            streamHadOutputRef.current = true;
            const snippet = formatToolSummarySnippet(ev.summary, ev.ok);
            lastToolBubbleSnippetRef.current = snippet;
            if (!ev.ok) {
              setAssistantStatusLine(null);
              setAssistantBubbleTextSynced((prev) => (prev.trim() ? prev : snippet));
              setAssistantBubbleStatus('revealing');
              pendingNewResponseRef.current = false;
            } else if (snippet && !pendingNewResponseRef.current) {
              setAssistantBubbleTextSynced((prev) => (prev.trim() ? prev : snippet));
              setAssistantBubbleStatus('streaming');
            } else {
              setAssistantBubbleStatus('streaming');
            }
            setState((s) => (s === 'thinking' ? 'responding' : s));
          }
          break;
        case 'error':
          streamHadOutputRef.current = true;
          setAssistantStatusLine(null);
          setAssistantBubbleTextSynced(
            formatCommandStreamError(ev.message, 'code' in ev ? String(ev.code) : undefined),
          );
          setAssistantBubbleStatus('revealing');
          setState('responding');
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
          commandStreamInFlightRef.current = false;
          if (!assistantBubbleTextRef.current.trim()) {
            if (streamHadOutputRef.current) {
              setAssistantBubbleStatus('revealing');
              setStateSynced((s) => (s === 'thinking' ? 'responding' : s));
              break;
            }
            const snippet = lastToolBubbleSnippetRef.current.trim();
            const fallback =
              snippet ||
              (introductionModeActiveRef.current
                ? ERROR_CODES.no_response
                : ERROR_CODES.tool_reply_failed);
            setAssistantBubbleTextSynced(fallback);
          }
          setAssistantBubbleStatus('revealing');
          setStateSynced((s) => (s === 'thinking' ? 'responding' : s));
          break;
        default:
          break;
      }
    },
    [endSession, queryClient, setAssistantBubbleTextSynced, setStateSynced],
  );

  const submitVisibleCommandText = useCallback(
    (raw: string, fromFollowUp: boolean) => {
      const captureState = stateRef.current;
      if (captureState === 'listening' || captureState === 'follow_up') {
        notifyCommandCaptureCommit();
      }
      const cleaned = cleanTranscript(raw);
      if (!cleaned) return;
      const displayText = liveCommandCaptionText(cleaned, fromFollowUp);
      const submitText = submitCommandText(cleaned, fromFollowUp);
      if (!submitText) {
        awaitingTranscriptRef.current = false;
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

      if (fromFollowUp && isSessionEndUtterance(submitText)) {
        console.debug('[Voice][SessionEnd] matched follow-up submit', { text: submitText });
        setUserBubbleText(displayText);
        endSession();
        return;
      }

      const nowMs = Date.now();
      const last = lastSubmittedTextRef.current;
      if (last && last.text === submitText && nowMs - last.atMs < 1500) return;
      if (commandStreamInFlightRef.current) return;
      const processingEpoch = commandProcessingEpochRef.current;
      lastSubmittedTextRef.current = { text: submitText, atMs: nowMs };
      responseRevealStartedRef.current = false;
      revealCompleteHandledRef.current = false;

      clearWakeTimeout();
      clearFollowUpTimer();
      followUpCaptureRef.current = false;
      resetInterimCaptionState();
      streamHadOutputRef.current = false;
      lastToolBubbleSnippetRef.current = '';
      setAssistantBubbleTextSynced('');
      setAssistantBubbleStatus('pending');
      pendingNewResponseRef.current = true;
      assignLiveTurnId();
      startRequestActivity();
      userBubbleTextRef.current = displayText;
      awaitingTranscriptRef.current = false;
      transcribeFromFollowUpRef.current = false;
      setUserBubbleText(displayText);
      if (processingEpoch !== commandProcessingEpochRef.current) return;
      setState('thinking');

      void (async () => {
        const claimed = await claimCommandMode();
        if (processingEpoch !== commandProcessingEpochRef.current) return;
        if (!claimed) {
          const msg = fromFollowUp
            ? ERROR_CODES.command_mode_not_owner
            : ERROR_CODES.invalid_session;
          setAssistantBubbleTextSynced(msg);
          setAssistantBubbleStatus('revealing');
          setState('responding');
          return;
        }

        const accessToken = await getAccessToken();
        if (processingEpoch !== commandProcessingEpochRef.current) return;
        if (!accessToken) {
          setAssistantBubbleTextSynced('Sign in to use the assistant.');
          setAssistantBubbleStatus('revealing');
          setState('responding');
          return;
        }

        if (!isConnected || !getRealtimeSessionToken()) {
          setAssistantBubbleTextSynced(ERROR_CODES.invalid_session);
          setAssistantBubbleStatus('revealing');
          setState('responding');
          return;
        }

        commandStreamInFlightRef.current = true;
        activeCommandStreamEpochRef.current = processingEpoch;
        abortActiveStream();
        const abortController = new AbortController();
        streamAbortRef.current = abortController;

        try {
          let sawDone = false;
          const streamText = introductionModeActiveRef.current
            ? streamIntroductionFromText
            : streamCommandFromText;
          for await (const ev of streamText(submitText, accessToken, {
            signal: abortController.signal,
          })) {
            if (processingEpoch !== commandProcessingEpochRef.current) break;
            if (abortController.signal.aborted) break;
            if (ev.type === 'error' && abortController.signal.aborted) continue;
            if (ev.type === 'done') sawDone = true;
            handleStreamEvent(ev);
          }
          if (
            processingEpoch === commandProcessingEpochRef.current &&
            !sawDone &&
            !abortController.signal.aborted &&
            (stateRef.current === 'responding' || stateRef.current === 'thinking')
          ) {
            handleStreamEvent({ type: 'done' });
          }
        } catch (e) {
          if (isAbortError(e) || abortController.signal.aborted) {
            if (
              processingEpoch === commandProcessingEpochRef.current &&
              stateRef.current === 'thinking' &&
              !streamHadOutputRef.current &&
              !assistantBubbleTextRef.current.trim()
            ) {
              setAssistantBubbleTextSynced('Request cancelled');
              setAssistantBubbleStatus('revealing');
              setState('responding');
            }
            return;
          }
          streamHadOutputRef.current = true;
          setAssistantBubbleTextSynced(getUserErrorMessage(e));
          setAssistantBubbleStatus('revealing');
          setState('responding');
        } finally {
          streamAbortRef.current = null;
          commandStreamInFlightRef.current = false;
        }
      })();
    },
    [
      abortActiveStream,
      assignLiveTurnId,
      claimCommandMode,
      clearFollowUpTimer,
      endSession,
      getAccessToken,
      goIdle,
      handleStreamEvent,
      isConnected,
      releaseCommandMode,
      resetInterimCaptionState,
      scheduleFollowUpExpiry,
      setAssistantBubbleTextSynced,
      startNewTurn,
      startRequestActivity,
    ],
  );

  const beginIntroduction = useCallback(async (): Promise<boolean> => {
    if (stateRef.current !== 'idle') return false;
    if (commandStreamInFlightRef.current) return false;

    setIntroductionModeActive(true);
    introductionModeActiveRef.current = true;
    startNewTurn();
    clearWakeTimeout();
    clearFollowUpTimer();
    followUpCaptureRef.current = false;
    pendingNewResponseRef.current = false;
    lastSubmittedTextRef.current = null;
    resetInterimCaptionState();
    streamHadOutputRef.current = false;
    lastToolBubbleSnippetRef.current = '';
    responseRevealStartedRef.current = false;
    revealCompleteHandledRef.current = false;
    setAssistantBubbleTextSynced('');
    setAssistantBubbleStatus('pending');
    pendingNewResponseRef.current = true;
    assignLiveTurnId();
    startRequestActivity();
    userBubbleTextRef.current = '';
    awaitingTranscriptRef.current = false;
    transcribeFromFollowUpRef.current = false;
    setUserBubbleText('');
    const introEpoch = commandProcessingEpochRef.current;
    commandStreamInFlightRef.current = true;
    activeCommandStreamEpochRef.current = introEpoch;
    setStateSynced('thinking');

    const failIntroduction = (message: string) => {
      streamHadOutputRef.current = true;
      setAssistantBubbleTextSynced(message);
      setAssistantBubbleStatus('revealing');
      setStateSynced('responding');
      return false;
    };

    try {
      const claimed = await claimCommandMode();
      if (!claimed) {
        return failIntroduction(ERROR_CODES.invalid_session);
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        return failIntroduction('Sign in to use the assistant.');
      }

      if (!isConnected || !getRealtimeSessionToken()) {
        return failIntroduction(ERROR_CODES.invalid_session);
      }

      abortActiveStream();
      const abortController = new AbortController();
      streamAbortRef.current = abortController;

      let sawDone = false;
      for await (const ev of streamIntroductionFromText(INTRODUCTION_KICKOFF_TEXT, accessToken, {
        signal: abortController.signal,
      })) {
        if (introEpoch !== commandProcessingEpochRef.current) break;
        if (abortController.signal.aborted) break;
        if (ev.type === 'error' && abortController.signal.aborted) continue;
        if (ev.type === 'done') sawDone = true;
        handleStreamEvent(ev);
      }
      if (
        introEpoch === commandProcessingEpochRef.current &&
        !sawDone &&
        !abortController.signal.aborted &&
        (['responding', 'thinking'] as CommandState[]).includes(stateRef.current as CommandState)
      ) {
        handleStreamEvent({ type: 'done' });
      }

      return (
        streamHadOutputRef.current ||
        assistantBubbleTextRef.current.trim().length > 0
      );
    } catch (e) {
      if (isAbortError(e)) {
        if (
          (stateRef.current as CommandState) === 'thinking' &&
          !streamHadOutputRef.current &&
          !assistantBubbleTextRef.current.trim()
        ) {
          failIntroduction('Request cancelled');
        }
        return false;
      }
      failIntroduction(getUserErrorMessage(e));
      return false;
    } finally {
      streamAbortRef.current = null;
      commandStreamInFlightRef.current = false;
    }
  }, [
    abortActiveStream,
    assignLiveTurnId,
    claimCommandMode,
    clearFollowUpTimer,
    clearWakeTimeout,
    getAccessToken,
    handleStreamEvent,
    isConnected,
    resetInterimCaptionState,
    setAssistantBubbleTextSynced,
    setStateSynced,
    startNewTurn,
    startRequestActivity,
  ]);

  const shouldDropStaleTranscriptFinal = useCallback((): boolean => {
    if (!suppressNextTranscriptFinalRef.current) return false;
    suppressNextTranscriptFinalRef.current = false;
    return true;
  }, []);

  const noteServerUtteranceId = useCallback((utteranceId: unknown) => {
    if (typeof utteranceId !== 'number' || !Number.isFinite(utteranceId)) return;
    lastServerUtteranceIdRef.current = utteranceId;
  }, []);

  useEffect(() => {
    const off = subscribeRealtimeMessages((msg) => {
      const current = stateRef.current;

      if (msg.event === 'command_transcript_error') {
        if (shouldDropStaleTranscriptFinal()) return;
        const text = formatWsTranscriptError({
          code: msg.code,
          message: msg.message,
        });
        setAssistantStatusLine(null);
        setAssistantBubbleTextSynced(text);
        setAssistantBubbleStatus('revealing');
        if (current === 'transcribing' || current === 'thinking') {
          setState('responding');
        }
        return;
      }

      if (msg.event === 'command_transcript_interim') {
        noteServerUtteranceId(msg.utterance_id);
        if (current === 'transcribing' || current === 'thinking' || current === 'responding') return;
        const text = cleanTranscript(typeof msg.text === 'string' ? msg.text : '');
        if (!text) return;

        // No live caption — UI updates only on command_transcript_final from the server.
        if (current === 'listening') {
          clearWakeFalsePositiveIfCommandInProgress(text);
          return;
        }

        if (current === 'follow_up') {
          if (commandStreamInFlightRef.current) return;
          if (text.trim().length < MIN_FOLLOW_UP_INTERIM_CHARS) return;
          onFollowUpSpeechActivity();
          followUpCaptureRef.current = true;
        }
        return;
      }

      if (msg.event === 'command_transcript_done') {
        if (current === 'listening' || current === 'follow_up') {
          suppressNextTranscriptFinalRef.current = false;
        }
        if (
          introductionModeActiveRef.current &&
          (current === 'thinking' || current === 'responding')
        ) {
          return;
        }
        // Final decode finished with no command_transcript_final (empty ASR).
        if (current === 'transcribing' && awaitingTranscriptRef.current) {
          const fromFollowUp = transcribeFromFollowUpRef.current;
          utteranceEndNotifiedRef.current = false;
          awaitingTranscriptRef.current = false;
          transcribeFromFollowUpRef.current = false;
          setAssistantStatusLine(null);
          setState(fromFollowUp ? 'follow_up' : 'listening');
          return;
        }
        if (
          (current === 'transcribing' ||
            (current === 'thinking' && !userBubbleTextRef.current.trim())) &&
          !commandStreamInFlightRef.current &&
          !userBubbleTextRef.current.trim() &&
          !awaitingTranscriptRef.current
        ) {
          const returnState = transcribeFromFollowUpRef.current ? 'follow_up' : 'listening';
          utteranceEndNotifiedRef.current = false;
          awaitingTranscriptRef.current = false;
          transcribeFromFollowUpRef.current = false;
          setAssistantStatusLine(null);
          setAssistantBubbleTextSynced('');
          setAssistantBubbleStatus('pending');
          setState(returnState);
        }
        return;
      }

      if (msg.event === 'command_transcript_final') {
        const utteranceId =
          typeof msg.utterance_id === 'number' && Number.isFinite(msg.utterance_id)
            ? msg.utterance_id
            : null;
        if (shouldDropStaleTranscriptFinal()) {
          if (utteranceId != null) {
            lastServerUtteranceIdRef.current = utteranceId;
          }
          return;
        }
        if (utteranceId != null) {
          lastServerUtteranceIdRef.current = utteranceId;
        }
        if (current === 'responding') return;

        const finalRaw = cleanTranscript(typeof msg.text === 'string' ? msg.text : '');
        const text = finalRaw || cleanTranscript(lastWakeInterimRef.current);
        resetInterimCaptionState();
        lastWakeInterimRef.current = '';

        if (current === 'transcribing' || (current === 'thinking' && awaitingTranscriptRef.current)) {
          const fromFollowUp = transcribeFromFollowUpRef.current;
          awaitingTranscriptRef.current = false;
          transcribeFromFollowUpRef.current = false;
          const trimmed = text.trim();
          if (!trimmed) {
            utteranceEndNotifiedRef.current = false;
            setState(fromFollowUp ? 'follow_up' : 'listening');
            return;
          }
          clearWakeFalsePositiveIfCommandInProgress(trimmed);
          submitVisibleCommandText(text, fromFollowUp);
          return;
        }

        if (current === 'listening') {
          const trimmed = text.trim();
          if (!trimmed) return;
          clearWakeFalsePositiveIfCommandInProgress(trimmed);
          if (!utteranceEndNotifiedRef.current) {
            utteranceEndNotifiedRef.current = true;
            awaitingTranscriptRef.current = true;
            setState('transcribing');
          }
          submitVisibleCommandText(text, false);
          return;
        }

        if (current === 'follow_up') {
          if (commandStreamInFlightRef.current) return;
          const trimmed = text.trim();
          if (!trimmed) return;
          if (isSessionEndUtterance(trimmed)) {
            console.debug('[Voice][SessionEnd] matched follow-up final', { text: trimmed });
            followUpCaptureRef.current = false;
            setUserBubbleText(trimmed);
            endSession();
            return;
          }
          if (!followUpCaptureRef.current) {
            // Backend may emit only final transcripts when interim decode is disabled.
            // Do not drop valid follow-up commands just because we never saw interim.
            if (trimmed.length < 2) {
              console.debug('[Voice][FollowUp] dropped short final without interim', { text: trimmed });
              return;
            }
            console.debug('[Voice][FollowUp] accepting final without interim', { text: trimmed });
          }
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
    releaseCommandMode,
    scheduleWakeFalsePositiveRelease,
    shouldDropStaleTranscriptFinal,
    noteServerUtteranceId,
    stableInterimCaption,
    submitVisibleCommandText,
  ]);

  useEffect(() => subscribeVoiceSpeechActivity(onFollowUpSpeechActivity), [onFollowUpSpeechActivity]);

  useEffect(() => {
    if (isServiceEnabled) return;
    // Passive service is intentionally off while command mode (or introduction) is active.
    if (isCommandMode || introductionModeActiveRef.current) return;
    const current = stateRef.current;
    if (current === 'idle' || current === 'locked') return;
    clearFollowUpTimer();
    clearWakeTimeout();
    abortActiveStream();
    localClaimRef.current = false;
    lastSubmittedTextRef.current = null;
    resetInterimCaptionState();
    setState('idle');
    resetLiveBubbles();
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    introductionModeActive,
    isCommandMode,
    isServiceEnabled,
    resetInterimCaptionState,
    resetLiveBubbles,
  ]);

  useEffect(() => {
    if (isCommandMode && !isCommandOwner) {
      abortActiveStream();
      clearFollowUpTimer();
      clearWakeTimeout();
      setState('locked');
      setBubbleHistory([]);
      resetLiveBubbles();
      showToast(ERROR_CODES.command_mode_not_owner, 'error');
      return;
    }
    if (stateRef.current === 'locked' && (!isCommandMode || isCommandOwner)) {
      goIdle();
    }
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    isCommandMode,
    isCommandOwner,
    resetLiveBubbles,
    showToast,
  ]);

  useEffect(() => {
    if (!localClaimRef.current || !commandModeExpiresAt) return;
    const statesWithClaim: CommandState[] = [
      'listening',
      'transcribing',
      'thinking',
      'responding',
      'follow_up',
    ];
    if (!statesWithClaim.includes(state)) return;

    const tick = () => {
      const expiresAtMs = Date.parse(commandModeExpiresAt);
      if (!Number.isFinite(expiresAtMs)) return;
      const remaining = expiresAtMs - Date.now();
      if (remaining > 0 && remaining < CLAIM_RENEW_BEFORE_EXPIRE_MS) {
        void claimCommandMode();
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [commandModeExpiresAt, claimCommandMode, state]);

  const dismissActiveCommand = useCallback(() => {
    const current = stateRef.current;
    if (current === 'idle' && !localClaimRef.current && !isCommandMode) return;
    if (COMMAND_PROCESSING_STATES.has(current)) {
      cancelProcessing();
      return;
    }
    cancelCommandMode();
  }, [cancelCommandMode, cancelProcessing, isCommandMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissActiveCommand();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissActiveCommand]);

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
    liveTurnId,
    cancelCommandMode,
    cancelProcessing,
    startListening,
    beginIntroduction,
    introductionModeActive,
    notifyCommandUtteranceEnded,
    notifyAssistantRevealStarted,
    notifyAssistantRevealComplete,
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

/** Placement region for the command bubble stack (mic → panel bottom). */
export function CommandBubbleStackHost({ className = '' }: { className?: string }) {
  const ctx = useContext(CommandContext);
  if (!ctx) return null;
  const { state, bubbleHistory } = ctx;
  if (state === 'idle' || state === 'locked') return null;
  if (state === 'transcribing' && bubbleHistory.length === 0) return null;

  return (
    <div
      className={`command-bubble-stack-host pointer-events-none absolute left-1/2 z-30 flex min-h-0 w-full max-w-[min(640px,calc(100vw-8rem))] -translate-x-1/2 flex-col overflow-hidden ${className}`}
      style={{
        top: 'calc(50% + var(--assistant-mic-half, 5rem) + var(--assistant-dock-gap, 0.75rem))',
        bottom: 0,
      }}
    >
      <div className="pointer-events-auto h-full min-h-0 min-w-0">
        <CommandBubble />
      </div>
    </div>
  );
}

/** @deprecated Use CommandState */
export type CommandMode = CommandState;
