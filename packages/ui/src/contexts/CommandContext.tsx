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
import {
  useAssistantRuntimeActions,
  useAssistantRuntimeState,
} from '@dadei/ui/contexts/AssistantRuntimeContext';
import { selectCommandMode, selectVoiceEnrollmentActive, selectCanClaimCommandService } from '@dadei/ui/lib/assistant/assistantRuntime';
import {
  markMicIntentHandled,
  runAssistantTransition,
  shouldAcceptMicIntent,
} from '@dadei/ui/lib/assistant/lifecycle/assistantLifecycle';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import axios from 'axios';
import {
  isAbortError,
  streamCommandFromText,
  type CommandSSEEvent,
} from '@dadei/ui/lib/workspace/api/command';
import {
  ENROLLMENT_KICKOFF_TEXT,
  ENROLLMENT_TRANSCRIPT_OPENER,
  type EnrollmentMode,
  type CommandMode,
} from '@dadei/ui/types/command.types';
import { serviceApi } from '@dadei/ui/lib/workspace/api/service';
import {
  getRealtimeSessionId,
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
} from '@dadei/ui/lib/assistant/voice/constants';
import {
  commandToolStatusLabel,
  formatAssistantStatusLine,
} from '@dadei/ui/lib/assistant/voice/labels/commandToolLabels';
import { isSessionEndUtterance } from '@dadei/ui/lib/assistant/voice/session/sessionEndDetection';
import {
  notifyCommandCaptureCommit,
  notifyCommandCaptureRearm,
  subscribeVoiceSpeechActivity,
} from '@dadei/ui/lib/assistant/voice/session/voiceSessionActivity';
import { CommandBubbleStack } from '@dadei/ui/components/command/CommandBubble';
import { formatForUser } from '@dadei/ui/lib/platform/shared/time';
import { COMMAND_PROCESSING_STATES } from '@dadei/ui/lib/assistant/assistantRuntime';

const ASSISTANT_STATUS_THINKING = 'Thinking';

import type { AssistantBubbleStatus, CommandState } from '@dadei/ui/types/command.types';

export type { AssistantBubbleStatus, CommandState } from '@dadei/ui/types/command.types';

export interface CommandTurnHistory {
  id: string;
  userText: string;
  assistantText: string;
}

interface CommandContextValue {
  state: CommandState;
  userBubbleText: string;
  /** True while caption text is provisional (streaming interim from ASR). */
  userCaptionInterim: boolean;
  assistantBubbleText: string;
  assistantBubbleStatus: AssistantBubbleStatus;
  /** Single in-bubble status while processing (Thinking… / current tool); cleared when text streams. */
  assistantStatusLine: string | null;
  bubbleHistory: CommandTurnHistory[];
  /** Stable id for the in-flight user+assistant pair (shared with history on commit). */
  liveTurnId: string | null;
  /** Leave command service and return to ambient listening; service on/off unchanged. */
  cancelCommandService: () => void;
  /** Abort in-flight transcription/response and re-open the mic in command service. */
  cancelProcessing: () => void;
  /** Manual command start without wake word (idle → listening). */
  startListening: () => void;
  /** Tutorial handoff → introduction enrollment on POST /service/command/text. */
  beginIntroduction: () => Promise<boolean>;
  /** Persons panel → retraining enrollment on the same command endpoint. */
  beginRetraining: () => Promise<boolean>;
  /** Runtime command mode; matches `mode` sent to POST /service/command/text. */
  commandMode: CommandMode;
  /** Introduction or retraining voice enrollment (not tutorial UI). */
  voiceEnrollmentActive: boolean;
  /** First typewriter character of the final response (mic → follow-up listen). */
  notifyAssistantRevealStarted: () => void;
  /** Typewriter finished; start the length-based follow-up idle window. */
  notifyAssistantRevealComplete: () => void;
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined);

/** Release wake-only capture if user never continues with a command. */
const WAKE_FALSE_POSITIVE_MS = 12_000;
/** Minimum follow-up final length (filters brief ASR noise). */
const MIN_FOLLOW_UP_FINAL_CHARS = 2;

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

export function CommandProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const { showToast } = useNotifications();
  const {
    isServiceEnabled,
    isConnected,
    isCommandService,
    isCommandOwner,
    commandServiceExpiresAt,
    syncCommandServiceFromClaim,
  } = useService();
  const runtimeActions = useAssistantRuntimeActions();
  const runtime = useAssistantRuntimeState();
  const commandMode = selectCommandMode(runtime);
  const voiceEnrollmentActive = selectVoiceEnrollmentActive(runtime);
  const commandModeRef = useRef(commandMode);
  const voiceEnrollmentActiveRef = useRef(voiceEnrollmentActive);

  useEffect(() => {
    commandModeRef.current = commandMode;
    voiceEnrollmentActiveRef.current = voiceEnrollmentActive;
  }, [commandMode, voiceEnrollmentActive]);

  const endVoiceEnrollmentMode = useCallback(() => {
    if (!voiceEnrollmentActiveRef.current) return;
    commandModeRef.current = 'normal';
    voiceEnrollmentActiveRef.current = false;
    runtimeActions.setCommandMode('normal');
    void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
  }, [queryClient, runtimeActions]);

  const state = runtime.commandState;
  const [userBubbleText, setUserBubbleText] = useState('');
  const [userCaptionInterim, setUserCaptionInterim] = useState(false);
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
  const ownsCommandSessionRef = useRef(isCommandOwner);
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  const lastSubmittedTextRef = useRef<{ text: string; atMs: number } | null>(null);
  const assistantBubbleTextRef = useRef('');
  const userBubbleTextRef = useRef('');
  const sessionEndingRef = useRef(false);
  const pendingNewResponseRef = useRef(false);
  const commandStreamInFlightRef = useRef(false);
  const streamHadOutputRef = useRef(false);
  const lastToolBubbleSnippetRef = useRef('');
  const lastCommittedTurnRef = useRef('');
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
  /** After a terminal stream error, ignore late tokens from the same HTTP response. */
  const streamTerminalErrorRef = useRef(false);
  /** Replace (do not append) the next spoken tokens after a mid-stream tool failure. */
  const replaceNextStreamTokensRef = useRef(false);
  /** User clicked mic to cancel — suppress error UI from aborted streams. */
  const userInitiatedCancelRef = useRef(false);
  /** Drop the next WS final after cancel while a live caption is in flight. */
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

  const setCommandState = useCallback(
    (next: CommandState | ((prev: CommandState) => CommandState)) => {
      const resolved = typeof next === 'function' ? next(stateRef.current) : next;
      stateRef.current = resolved;
      runtimeActions.setCommandState(resolved);
    },
    [runtimeActions],
  );

  useEffect(() => {
    ownsCommandSessionRef.current = isCommandOwner;
    stateRef.current = state;
  }, [isCommandOwner, state]);

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

  const releaseCommandServiceInner = useCallback(async (): Promise<boolean> => {
    const sessionToken = getRealtimeSessionToken();
    if (!sessionToken) return false;
    try {
      await serviceApi.releaseCommandService(sessionToken);
      return true;
    } catch (error) {
      console.warn('[Command] Failed to release assistant mode', error);
      return false;
    }
  }, []);

  const releaseCommandService = useCallback(async (): Promise<boolean> => {
    return runAssistantTransition(() => releaseCommandServiceInner());
  }, [releaseCommandServiceInner]);

  const startRequestActivity = useCallback(() => {
    setAssistantStatusLine(formatAssistantStatusLine(ASSISTANT_STATUS_THINKING));
  }, []);

  const notifyAssistantRevealStarted = useCallback(() => {
    if (responseRevealStartedRef.current) return;
    responseRevealStartedRef.current = true;
    // Introduction: keep mic sealed while the canned opener types out — opening on
    // the first character was buffering ambient audio to the 20s decode cap.
    if (voiceEnrollmentActiveRef.current) return;
    setCommandState('follow_up');
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
    pendingNewResponseRef.current = false;
    lastToolBubbleSnippetRef.current = '';
    clearLiveTurnId();
    setAssistantStatusLine(null);
    setUserBubbleText('');
    setUserCaptionInterim(false);
    setAssistantBubbleTextSynced('');
    setAssistantBubbleStatus('pending');
  }, [clearLiveTurnId, setAssistantBubbleTextSynced]);

  const goIdle = useCallback(() => {
    clearFollowUpTimer();
    clearWakeTimeout();
    abortActiveStream();
    sessionEndingRef.current = false;
    lastSubmittedTextRef.current = null;
    lastCommittedTurnRef.current = '';
    setBubbleHistory([]);
    setCommandState('idle');
    resetLiveBubbles();
  }, [abortActiveStream, clearFollowUpTimer, clearWakeTimeout, resetLiveBubbles]);

  const endSession = useCallback(() => {
    endVoiceEnrollmentMode();
    sessionEndingRef.current = true;
    clearFollowUpTimer();
    clearWakeTimeout();
    abortActiveStream();
    void (async () => {
      if (ownsCommandSessionRef.current) {
        await releaseCommandServiceInner();
      }
      goIdle();
    })();
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    endVoiceEnrollmentMode,
    releaseCommandService,
  ]);

  const cancelCommandService = useCallback(() => {
    void runAssistantTransition(async () => {
      const hadProcessing = COMMAND_PROCESSING_STATES.has(stateRef.current);
      userInitiatedCancelRef.current = true;
      commandProcessingEpochRef.current += 1;
      activeCommandStreamEpochRef.current = commandProcessingEpochRef.current;
      suppressNextTranscriptFinalRef.current = false;
      endVoiceEnrollmentMode();
      clearFollowUpTimer();
      clearWakeTimeout();
      abortActiveStream();
      sendRealtimeMessage({ type: 'command_audio_cancel' });
      if (hadProcessing) {
        const sessionId = getRealtimeSessionId();
        sendRealtimeMessage({
          type: 'command_inference_cancel',
          ...(sessionId ? { session_id: sessionId } : {}),
        });
      }
      if (ownsCommandSessionRef.current) {
        await releaseCommandServiceInner();
      }
      goIdle();
    });
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    endVoiceEnrollmentMode,
    releaseCommandService,
  ]);

  const rollbackVoiceEnrollmentAttempt = useCallback(async () => {
    commandProcessingEpochRef.current += 1;
    suppressNextTranscriptFinalRef.current = true;
    endVoiceEnrollmentMode();
    abortActiveStream();
    commandStreamInFlightRef.current = false;
    if (ownsCommandSessionRef.current) {
      await releaseCommandService();
    }
    goIdle();
  }, [abortActiveStream, endVoiceEnrollmentMode, goIdle, releaseCommandService]);

  const claimCommandService = useCallback(async (): Promise<boolean> => {
    return runAssistantTransition(async () => {
      const sessionId = getRealtimeSessionId();
      if (!selectCanClaimCommandService(runtimeRef.current, sessionId)) return false;
      const sessionToken = getRealtimeSessionToken();
      if (!sessionToken) return false;
      try {
        const claimed = await serviceApi.claimCommandService(sessionToken, CLAIM_HOLD_SECONDS);
        syncCommandServiceFromClaim(claimed);
        return true;
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 409) {
          setCommandState('locked');
          resetLiveBubbles();
          return false;
        }
        console.warn('[Command] claim failed', e);
        return false;
      }
    });
  }, [resetLiveBubbles, syncCommandServiceFromClaim]);

  const scheduleWakeFalsePositiveRelease = useCallback(() => {
    clearWakeTimeout();
    wakeTimeoutRef.current = setTimeout(() => {
      if (stateRef.current !== 'listening') return;
      void (async () => {
        endVoiceEnrollmentMode();
        await releaseCommandService();
        goIdle();
      })();
    }, WAKE_FALSE_POSITIVE_MS);
  }, [clearWakeTimeout, endVoiceEnrollmentMode, goIdle, releaseCommandService]);

  const cancelProcessing = useCallback(() => {
    if (!COMMAND_PROCESSING_STATES.has(stateRef.current)) return;

    const inVoiceEnrollment = voiceEnrollmentActiveRef.current;
    const cancellingLiveCaption =
      awaitingTranscriptRef.current &&
      (stateRef.current === 'listening' || stateRef.current === 'follow_up');
    userInitiatedCancelRef.current = true;
    streamTerminalErrorRef.current = false;
    replaceNextStreamTokensRef.current = false;
    commandProcessingEpochRef.current += 1;
    activeCommandStreamEpochRef.current = commandProcessingEpochRef.current;
    suppressNextTranscriptFinalRef.current = cancellingLiveCaption;

    if (!inVoiceEnrollment) {
      endVoiceEnrollmentMode();
    }
    abortActiveStream();
    clearFollowUpTimer();
    clearWakeTimeout();
    utteranceEndNotifiedRef.current = false;
    awaitingTranscriptRef.current = false;
    transcribeFromFollowUpRef.current = false;
    responseRevealStartedRef.current = false;
    revealCompleteHandledRef.current = false;
    pendingNewResponseRef.current = false;
    lastSubmittedTextRef.current = null;
    streamHadOutputRef.current = false;
    lastToolBubbleSnippetRef.current = '';
    resetLiveBubbles();
    commandStreamInFlightRef.current = false;
    setCommandState(inVoiceEnrollment ? 'follow_up' : 'listening');
    if (!inVoiceEnrollment) {
      scheduleWakeFalsePositiveRelease();
    }
    const sessionId = getRealtimeSessionId();
    sendRealtimeMessage({
      type: 'command_inference_cancel',
      ...(sessionId ? { session_id: sessionId } : {}),
    });
    sendRealtimeMessage({ type: 'command_audio_discard' });
    sendRealtimeMessage({
      type: 'command_audio_wake',
      ...(sessionId ? { session_id: sessionId } : {}),
    });
    notifyCommandCaptureRearm();
    console.debug('[Voice][Cancel] cancelProcessing', {
      state: stateRef.current,
      epoch: commandProcessingEpochRef.current,
    });
  }, [
    clearFollowUpTimer,
    clearWakeTimeout,
    endVoiceEnrollmentMode,
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
        if (voiceEnrollmentActiveRef.current) return;
        endVoiceEnrollmentMode();
        await releaseCommandService();
        goIdle();
      })();
    }, ms);
  }, [clearFollowUpTimer, endVoiceEnrollmentMode, goIdle, releaseCommandService]);

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
    void claimCommandService();
    if (voiceEnrollmentActiveRef.current) {
      // Introduction stays active until inference ends the session — no follow-up idle timer.
      setCommandState('follow_up');
    } else {
      scheduleFollowUpExpiry(assistant.length);
    }
  }, [
    claimCommandService,
    commitLiveTurnToHistory,
    scheduleFollowUpExpiry,
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
    pendingNewResponseRef.current = false;
    lastSubmittedTextRef.current = null;
    setAssistantBubbleTextSynced('');
    setAssistantBubbleStatus('pending');
    setAssistantStatusLine(null);

    // Arm server capture before HTTP claim so in-flight PCM is promoted, not discarded.
    sendRealtimeMessage({ type: 'command_audio_wake' });

    const claimed = await claimCommandService();
    if (!claimed) return false;

    if (!liveTurnIdRef.current) {
      assignLiveTurnId();
    }
    setCommandState('listening');
    scheduleWakeFalsePositiveRelease();
    return true;
  }, [
    claimCommandService,
    clearFollowUpTimer,
    clearWakeTimeout,
    scheduleWakeFalsePositiveRelease,
    setAssistantBubbleTextSynced,
    assignLiveTurnId,
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
      if (
        streamTerminalErrorRef.current &&
        (ev.type === 'token' || ev.type === 'tool_result' || ev.type === 'tool_call')
      ) {
        return;
      }
      switch (ev.type) {
        case 'transcript':
          break;
        case 'token':
          streamHadOutputRef.current = true;
          setCommandState((s) => (s === 'thinking' ? 'responding' : s));
          setAssistantBubbleStatus('streaming');
          setAssistantBubbleTextSynced((prev) => {
            if (pendingNewResponseRef.current || replaceNextStreamTokensRef.current) {
              pendingNewResponseRef.current = false;
              replaceNextStreamTokensRef.current = false;
              return ev.text;
            }
            return prev + ev.text;
          });
          break;
        case 'tool_call': {
          streamHadOutputRef.current = true;
          setCommandState((s) => (s === 'thinking' ? 'responding' : s));
          setAssistantBubbleStatus('pending');
          const label = commandToolStatusLabel(ev.tool, ev.args, {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
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
            if (!ev.ok) {
              lastToolBubbleSnippetRef.current = snippet;
              replaceNextStreamTokensRef.current = true;
              setAssistantStatusLine(null);
              setAssistantBubbleStatus('pending');
              setCommandState((s) => (s === 'thinking' ? 'responding' : s));
              break;
            }
            lastToolBubbleSnippetRef.current = snippet;
            if (snippet && !pendingNewResponseRef.current) {
              setAssistantBubbleTextSynced((prev) => (prev.trim() ? prev : snippet));
              setAssistantBubbleStatus('streaming');
            } else {
              setAssistantBubbleStatus('streaming');
            }
            setCommandState((s) => (s === 'thinking' ? 'responding' : s));
          }
          break;
        case 'error':
          if (userInitiatedCancelRef.current) break;
          streamTerminalErrorRef.current = true;
          streamHadOutputRef.current = true;
          pendingNewResponseRef.current = false;
          setAssistantStatusLine(null);
          setAssistantBubbleTextSynced(
            formatCommandStreamError(ev.message, 'code' in ev ? String(ev.code) : undefined),
          );
          setAssistantBubbleStatus('revealing');
          setCommandState('responding');
          break;
        case 'session_end':
          setAssistantBubbleStatus('done');
          endSession();
          break;
        case 'done':
          if (stateRef.current === 'idle' || sessionEndingRef.current) break;
          pendingNewResponseRef.current = false;
          setAssistantStatusLine(null);
          commandStreamInFlightRef.current = false;
          if (!assistantBubbleTextRef.current.trim()) {
            if (streamHadOutputRef.current) {
              setAssistantBubbleStatus('revealing');
              setCommandState((s) => (s === 'thinking' ? 'responding' : s));
              break;
            }
            const snippet = lastToolBubbleSnippetRef.current.trim();
            const fallback =
              snippet ||
              (voiceEnrollmentActiveRef.current
                ? ERROR_CODES.no_response
                : ERROR_CODES.tool_reply_failed);
            setAssistantBubbleTextSynced(fallback);
          }
          setAssistantBubbleStatus('revealing');
          setCommandState((s) => (s === 'thinking' ? 'responding' : s));
          break;
        default:
          break;
      }
    },
    [endSession, queryClient, setAssistantBubbleTextSynced, setCommandState],
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
            setCommandState('listening');
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
      userInitiatedCancelRef.current = false;
      streamTerminalErrorRef.current = false;
      replaceNextStreamTokensRef.current = false;
      lastSubmittedTextRef.current = { text: submitText, atMs: nowMs };
      responseRevealStartedRef.current = false;
      revealCompleteHandledRef.current = false;

      clearWakeTimeout();
      clearFollowUpTimer();
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
      setUserCaptionInterim(false);
      setUserBubbleText(displayText);
      if (processingEpoch !== commandProcessingEpochRef.current) return;
      setCommandState('thinking');

      void (async () => {
        const claimed = await claimCommandService();
        if (processingEpoch !== commandProcessingEpochRef.current) return;
        if (!claimed) {
          const msg = fromFollowUp
            ? ERROR_CODES.command_mode_not_owner
            : ERROR_CODES.invalid_session;
          setAssistantBubbleTextSynced(msg);
          setAssistantBubbleStatus('revealing');
          setCommandState('responding');
          return;
        }

        const accessToken = await getAccessToken();
        if (processingEpoch !== commandProcessingEpochRef.current) return;
        if (!accessToken) {
          setAssistantBubbleTextSynced('Sign in to use the assistant.');
          setAssistantBubbleStatus('revealing');
          setCommandState('responding');
          return;
        }

        if (!isConnected || !getRealtimeSessionToken()) {
          setAssistantBubbleTextSynced(ERROR_CODES.invalid_session);
          setAssistantBubbleStatus('revealing');
          setCommandState('responding');
          return;
        }

        commandStreamInFlightRef.current = true;
        activeCommandStreamEpochRef.current = processingEpoch;
        abortActiveStream();
        const abortController = new AbortController();
        streamAbortRef.current = abortController;

        try {
          let sawDone = false;
          const streamMode = commandModeRef.current;
          for await (const ev of streamCommandFromText(submitText, accessToken, {
            signal: abortController.signal,
            mode: streamMode,
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
          if (
            userInitiatedCancelRef.current ||
            isAbortError(e) ||
            abortController.signal.aborted
          ) {
            return;
          }
          streamTerminalErrorRef.current = true;
          streamHadOutputRef.current = true;
          setAssistantBubbleTextSynced(getUserErrorMessage(e));
          setAssistantBubbleStatus('revealing');
          setCommandState('responding');
        } finally {
          streamAbortRef.current = null;
          commandStreamInFlightRef.current = false;
        }
      })();
    },
    [
      abortActiveStream,
      assignLiveTurnId,
      claimCommandService,
      clearFollowUpTimer,
      endSession,
      getAccessToken,
      goIdle,
      handleStreamEvent,
      isConnected,
      releaseCommandService,
      scheduleFollowUpExpiry,
      setAssistantBubbleTextSynced,
      startNewTurn,
      startRequestActivity,
    ],
  );

  const beginVoiceEnrollmentKickoff = useCallback(
    async (enrollmentMode: EnrollmentMode): Promise<boolean> => {
      if (stateRef.current !== 'idle') return false;
      if (commandStreamInFlightRef.current) return false;

      runtimeActions.setCommandMode(enrollmentMode);
      commandModeRef.current = enrollmentMode;
      voiceEnrollmentActiveRef.current = true;
      startNewTurn();
      clearWakeTimeout();
      clearFollowUpTimer();
      pendingNewResponseRef.current = false;
      lastSubmittedTextRef.current = null;
      streamHadOutputRef.current = false;
      lastToolBubbleSnippetRef.current = '';
      responseRevealStartedRef.current = false;
      revealCompleteHandledRef.current = false;
      setAssistantBubbleTextSynced('');
      setAssistantBubbleStatus('pending');
      pendingNewResponseRef.current = true;
      assignLiveTurnId();
      startRequestActivity();
      userBubbleTextRef.current = ENROLLMENT_TRANSCRIPT_OPENER;
      awaitingTranscriptRef.current = false;
      transcribeFromFollowUpRef.current = false;
      setUserBubbleText(ENROLLMENT_TRANSCRIPT_OPENER);
      const kickoffEpoch = commandProcessingEpochRef.current;
      commandStreamInFlightRef.current = true;
      activeCommandStreamEpochRef.current = kickoffEpoch;
      setCommandState('thinking');

      try {
        const claimed = await claimCommandService();
        if (!claimed) {
          await rollbackVoiceEnrollmentAttempt();
          return false;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
          await rollbackVoiceEnrollmentAttempt();
          return false;
        }

        if (!isConnected || !getRealtimeSessionToken()) {
          await rollbackVoiceEnrollmentAttempt();
          return false;
        }

        abortActiveStream();
        const abortController = new AbortController();
        streamAbortRef.current = abortController;

        let sawDone = false;
        let kickoffErrored = false;
        for await (const ev of streamCommandFromText(ENROLLMENT_KICKOFF_TEXT, accessToken, {
          signal: abortController.signal,
          mode: enrollmentMode,
        })) {
          if (kickoffEpoch !== commandProcessingEpochRef.current) break;
          if (abortController.signal.aborted) break;
          if (ev.type === 'error' && abortController.signal.aborted) continue;
          if (ev.type === 'error') kickoffErrored = true;
          if (ev.type === 'done') sawDone = true;
          handleStreamEvent(ev);
        }
        if (
          kickoffEpoch === commandProcessingEpochRef.current &&
          !sawDone &&
          !abortController.signal.aborted &&
          (['responding', 'thinking'] as CommandState[]).includes(stateRef.current as CommandState)
        ) {
          handleStreamEvent({ type: 'done' });
        }

        const kickoffOk =
          kickoffEpoch === commandProcessingEpochRef.current &&
          !kickoffErrored &&
          !abortController.signal.aborted &&
          (streamHadOutputRef.current || assistantBubbleTextRef.current.trim().length > 0);

        if (!kickoffOk) {
          await rollbackVoiceEnrollmentAttempt();
          return false;
        }
        return true;
      } catch (e) {
        if (isAbortError(e)) {
          await rollbackVoiceEnrollmentAttempt();
          return false;
        }
        await rollbackVoiceEnrollmentAttempt();
        return false;
      } finally {
        streamAbortRef.current = null;
        commandStreamInFlightRef.current = false;
      }
    },
    [
      abortActiveStream,
      assignLiveTurnId,
      claimCommandService,
      clearFollowUpTimer,
      clearWakeTimeout,
      getAccessToken,
      handleStreamEvent,
      isConnected,
      rollbackVoiceEnrollmentAttempt,
      runtimeActions,
      setAssistantBubbleTextSynced,
      setCommandState,
      startNewTurn,
      startRequestActivity,
    ],
  );

  const beginIntroduction = useCallback(
    () => beginVoiceEnrollmentKickoff('introduction'),
    [beginVoiceEnrollmentKickoff],
  );

  const beginRetraining = useCallback(
    () => beginVoiceEnrollmentKickoff('retraining'),
    [beginVoiceEnrollmentKickoff],
  );

  const shouldDropStaleTranscriptFinal = useCallback((): boolean => {
    if (!suppressNextTranscriptFinalRef.current) return false;
    suppressNextTranscriptFinalRef.current = false;
    return true;
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
        if (current === 'thinking') {
          setCommandState('responding');
        }
        return;
      }

      if (msg.event === 'command_transcript_done') {
        if (current === 'listening' || current === 'follow_up') {
          suppressNextTranscriptFinalRef.current = false;
        }
        if (
          voiceEnrollmentActiveRef.current &&
          (current === 'thinking' || current === 'responding')
        ) {
          return;
        }
        // Final decode finished with no command_transcript_final (empty ASR).
        if (
          (current === 'listening' || current === 'follow_up') &&
          awaitingTranscriptRef.current
        ) {
          const fromFollowUp = transcribeFromFollowUpRef.current;
          utteranceEndNotifiedRef.current = false;
          awaitingTranscriptRef.current = false;
          transcribeFromFollowUpRef.current = false;
          suppressNextTranscriptFinalRef.current = false;
          setUserCaptionInterim(false);
          setAssistantStatusLine(null);
          setCommandState(fromFollowUp ? 'follow_up' : 'listening');
          return;
        }
        if (
          current === 'thinking' &&
          !commandStreamInFlightRef.current &&
          !userBubbleTextRef.current.trim() &&
          !awaitingTranscriptRef.current
        ) {
          const returnState = transcribeFromFollowUpRef.current ? 'follow_up' : 'listening';
          utteranceEndNotifiedRef.current = false;
          awaitingTranscriptRef.current = false;
          transcribeFromFollowUpRef.current = false;
          suppressNextTranscriptFinalRef.current = false;
          setAssistantStatusLine(null);
          setAssistantBubbleTextSynced('');
          setAssistantBubbleStatus('pending');
          setCommandState(returnState);
        }
        return;
      }

      if (msg.event === 'command_transcript_interim') {
        if (current === 'idle' || current === 'locked' || current === 'responding') return;
        if (shouldDropStaleTranscriptFinal()) return;

        const utteranceId =
          typeof msg.utterance_id === 'number' && Number.isFinite(msg.utterance_id)
            ? msg.utterance_id
            : null;
        if (
          utteranceId != null &&
          lastServerUtteranceIdRef.current != null &&
          utteranceId < lastServerUtteranceIdRef.current
        ) {
          return;
        }

        const raw = typeof msg.text === 'string' ? msg.text : '';
        if (!liveTurnIdRef.current) {
          assignLiveTurnId();
        }

        if (current === 'listening' || current === 'follow_up') {
          if (!utteranceEndNotifiedRef.current) {
            utteranceEndNotifiedRef.current = true;
            awaitingTranscriptRef.current = true;
            transcribeFromFollowUpRef.current = current === 'follow_up';
          }
        }

        userBubbleTextRef.current = raw;
        setUserCaptionInterim(true);
        setUserBubbleText(raw);
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
        const text = finalRaw;

        if (
          current === 'listening' ||
          current === 'follow_up' ||
          (current === 'thinking' && awaitingTranscriptRef.current)
        ) {
          const fromFollowUp =
            transcribeFromFollowUpRef.current || current === 'follow_up';
          awaitingTranscriptRef.current = false;
          transcribeFromFollowUpRef.current = false;
          utteranceEndNotifiedRef.current = false;
          setUserCaptionInterim(false);
          const trimmed = text.trim();
          if (!trimmed) {
            setCommandState(fromFollowUp ? 'follow_up' : 'listening');
            return;
          }
          if (fromFollowUp) {
            if (commandStreamInFlightRef.current) return;
            if (isSessionEndUtterance(trimmed)) {
              console.debug('[Voice][SessionEnd] matched follow-up final', { text: trimmed });
              setUserBubbleText(trimmed);
              endSession();
              return;
            }
            if (trimmed.length < MIN_FOLLOW_UP_FINAL_CHARS) {
              console.debug('[Voice][FollowUp] dropped short final', { text: trimmed });
              return;
            }
          }
          clearWakeFalsePositiveIfCommandInProgress(trimmed);
          submitVisibleCommandText(text, fromFollowUp);
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
    releaseCommandService,
    scheduleWakeFalsePositiveRelease,
    assignLiveTurnId,
    shouldDropStaleTranscriptFinal,
    submitVisibleCommandText,
  ]);

  useEffect(() => subscribeVoiceSpeechActivity(onFollowUpSpeechActivity), [onFollowUpSpeechActivity]);

  useEffect(() => {
    if (isServiceEnabled) return;
    // Ambient service is intentionally off while command mode (or voice enrollment) is active.
    if (isCommandService || voiceEnrollmentActiveRef.current) return;
    const current = stateRef.current;
    if (current === 'idle' || current === 'locked') return;
    clearFollowUpTimer();
    clearWakeTimeout();
    abortActiveStream();
    lastSubmittedTextRef.current = null;
    setCommandState('idle');
    resetLiveBubbles();
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    voiceEnrollmentActive,
    isCommandService,
    isServiceEnabled,
    resetLiveBubbles,
  ]);

  useEffect(() => {
    if (isCommandService && !isCommandOwner) {
      abortActiveStream();
      clearFollowUpTimer();
      clearWakeTimeout();
      setCommandState('locked');
      setBubbleHistory([]);
      resetLiveBubbles();
      showToast(ERROR_CODES.command_mode_not_owner, 'error');
      return;
    }
    if (stateRef.current === 'locked' && (!isCommandService || isCommandOwner)) {
      goIdle();
    }
  }, [
    abortActiveStream,
    clearFollowUpTimer,
    clearWakeTimeout,
    goIdle,
    isCommandService,
    isCommandOwner,
    resetLiveBubbles,
    showToast,
  ]);

  useEffect(() => {
    if (!isCommandOwner || !commandServiceExpiresAt) return;
    const statesWithClaim: CommandState[] = [
      'listening',
      'thinking',
      'responding',
      'follow_up',
    ];
    if (!statesWithClaim.includes(state)) return;

    const tick = () => {
      const expiresAtMs = Date.parse(commandServiceExpiresAt);
      if (!Number.isFinite(expiresAtMs)) return;
      const remaining = expiresAtMs - Date.now();
      if (remaining > 0 && remaining < CLAIM_RENEW_BEFORE_EXPIRE_MS) {
        void claimCommandService();
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [commandServiceExpiresAt, claimCommandService, isCommandOwner, state]);

  const dismissActiveCommand = useCallback(() => {
    if (!shouldAcceptMicIntent()) return;
    const current = stateRef.current;
    if (current === 'idle' && !isCommandOwner && !isCommandService) return;
    markMicIntentHandled();
    if (COMMAND_PROCESSING_STATES.has(current)) {
      cancelProcessing();
      return;
    }
    cancelCommandService();
  }, [cancelCommandService, cancelProcessing, isCommandService, isCommandOwner]);

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
    userCaptionInterim,
    assistantBubbleText,
    assistantBubbleStatus,
    assistantStatusLine,
    bubbleHistory,
    liveTurnId,
    cancelCommandService,
    cancelProcessing,
    startListening,
    beginIntroduction,
    beginRetraining,
    commandMode,
    voiceEnrollmentActive,
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
  const { state } = ctx;
  if (state === 'idle' || state === 'locked') return null;

  return (
    <div
      className={`command-bubble-stack-host pointer-events-none absolute left-1/2 z-30 flex min-h-0 w-full max-w-[min(520px,calc(100vw-3rem))] -translate-x-1/2 flex-col overflow-visible ${className}`}
      style={{
        top: 'calc(50% + var(--assistant-mic-half, 5rem) + var(--assistant-dock-gap, 0.75rem))',
        bottom: 0,
      }}
    >
      <div className="pointer-events-auto h-full min-h-0 min-w-0">
        <CommandBubbleStack />
      </div>
    </div>
  );
}

