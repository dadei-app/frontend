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
  normalizeVisibleCommandText,
  transcriptStartsWithWakeCommand,
} from '@dadei/ui/lib/wakeWordDetection';
import {
  CLAIM_HOLD_SECONDS,
  CLAIM_RENEW_BEFORE_EXPIRE_MS,
  computeFollowUpMs,
} from '@dadei/ui/lib/voice/voiceConstants';

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
  activeToolCall: string | undefined;
  bubbleHistory: CommandTurnHistory[];
  cancel: () => void;
  /** Manual command start without wake word (idle → listening). */
  startListening: () => void;
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined);

const WAKE_FALSE_POSITIVE_MS = 4_000;

const TOOL_LABELS: Record<string, string> = {
  create_calendar_event: 'Creating calendar event',
  create_reminder: 'Creating reminder',
  create_task: 'Creating task',
  store_memory: 'Saving memory',
  search_memory: 'Searching memory',
  get_current_time: 'Getting time',
  send_email: 'Sending email',
  web_search: 'Searching the web',
  update_memory: 'Updating memory',
  update_action: 'Updating action',
  list_calendar_events: 'Checking calendar',
  update_calendar_event: 'Updating event',
  delete_calendar_event: 'Deleting event',
  list_tasks: 'Checking tasks',
  update_task: 'Updating task',
  delete_task: 'Deleting task',
  search_contacts: 'Finding contact',
  read_email: 'Reading email',
  search_email: 'Searching email',
  search_interactions: 'Searching past conversations',
  query_person_memory: 'Recalling about person',
  assign_person_name: 'Saving name',
  get_weather: 'Checking weather',
  get_weather_forecast: 'Checking forecast',
};

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

function cleanTranscript(raw: string): string {
  const cleaned = sanitizeCommandTranscript(raw);
  if (!cleaned || isInstructionalTranscriptBleed(cleaned)) return '';
  return cleaned;
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
  const [activeToolCall, setActiveToolCall] = useState<string | undefined>(undefined);
  const [bubbleHistory, setBubbleHistory] = useState<CommandTurnHistory[]>([]);

  const stateRef = useRef(state);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const localClaimRef = useRef(false);
  const lastSubmittedTextRef = useRef<{ text: string; atMs: number } | null>(null);
  const lastWakeInterimRef = useRef('');
  const assistantBubbleTextRef = useRef('');
  const followUpCaptureRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    assistantBubbleTextRef.current = assistantBubbleText;
  }, [assistantBubbleText]);

  const clearFollowUpTimer = useCallback(() => {
    if (followUpTimerRef.current != null) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
  }, []);

  /** Pause follow-up expiry while the user is speaking (do not go idle mid-utterance). */
  const pauseFollowUpTimer = clearFollowUpTimer;

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

  const resetLiveBubbles = useCallback(() => {
    setUserBubbleText('');
    setAssistantBubbleText('');
    setAssistantBubbleStatus('pending');
    setActiveToolCall(undefined);
  }, []);

  const goIdle = useCallback(() => {
    clearFollowUpTimer();
    clearWakeTimeout();
    abortActiveStream();
    setBubbleHistory([]);
    setState('idle');
    resetLiveBubbles();
  }, [abortActiveStream, clearFollowUpTimer, clearWakeTimeout, resetLiveBubbles]);

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

  const scheduleFollowUpExpiry = useCallback(
    (responseChars: number) => {
      clearFollowUpTimer();
      const ms = computeFollowUpMs(responseChars);
      followUpTimerRef.current = setTimeout(() => {
        void (async () => {
          await releaseAssistantMode();
          goIdle();
        })();
      }, ms);
    },
    [clearFollowUpTimer, goIdle, releaseAssistantMode],
  );

  const startNewTurn = useCallback(() => {
    clearFollowUpTimer();
    clearWakeTimeout();
    resetLiveBubbles();
  }, [clearFollowUpTimer, clearWakeTimeout, resetLiveBubbles]);

  const startListening = useCallback(() => {
    if (stateRef.current !== 'idle') return;
    startNewTurn();
    setState('listening');
    void (async () => {
      await claimAssistantMode();
      scheduleWakeFalsePositiveRelease();
    })();
  }, [claimAssistantMode, scheduleWakeFalsePositiveRelease, startNewTurn]);

  const handleStreamEvent = useCallback(
    (ev: CommandSSEEvent) => {
      switch (ev.type) {
        case 'transcript':
          break;
        case 'token':
          setState((s) => (s === 'thinking' ? 'responding' : s));
          setAssistantBubbleStatus('streaming');
          setAssistantBubbleText((prev) => prev + ev.text);
          break;
        case 'tool_call':
          setState((s) => (s === 'thinking' ? 'responding' : s));
          setAssistantBubbleStatus('streaming');
          setActiveToolCall(toolLabel(ev.tool));
          break;
        case 'tool_result':
          setActiveToolCall(undefined);
          break;
        case 'error':
          setAssistantBubbleText(ev.message);
          setAssistantBubbleStatus('done');
          setState('follow_up');
          scheduleFollowUpExpiry(ev.message.length);
          break;
        case 'done':
          setAssistantBubbleStatus('done');
          setUserBubbleText('');
          setState('follow_up');
          void claimAssistantMode();
          scheduleFollowUpExpiry(assistantBubbleTextRef.current.length);
          break;
        default:
          break;
      }
    },
    [claimAssistantMode, scheduleFollowUpExpiry],
  );

  const submitVisibleCommandText = useCallback(
    (raw: string, fromFollowUp: boolean) => {
      const cleaned = cleanTranscript(raw);
      if (!cleaned) return;
      const visible = fromFollowUp ? cleaned.trim() : normalizeVisibleCommandText(cleaned);
      if (!visible) return;
      const nowMs = Date.now();
      const last = lastSubmittedTextRef.current;
      if (last && last.text === visible && nowMs - last.atMs < 1500) return;
      lastSubmittedTextRef.current = { text: visible, atMs: nowMs };

      clearWakeTimeout();
      clearFollowUpTimer();
      setUserBubbleText(visible);
      setAssistantBubbleText('');
      setAssistantBubbleStatus('pending');
      setActiveToolCall(undefined);
      setState('thinking');

      void (async () => {
        const claimed = await claimAssistantMode();
        if (!claimed) {
          const msg = fromFollowUp
            ? 'Could not keep assistant mode for follow-up'
            : 'Could not claim assistant mode';
          setAssistantBubbleText(msg);
          setAssistantBubbleStatus('done');
          setState(fromFollowUp ? 'follow_up' : 'idle');
          if (fromFollowUp) scheduleFollowUpExpiry(0);
          return;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
          setAssistantBubbleText('Not authenticated');
          setAssistantBubbleStatus('done');
          setState('follow_up');
          scheduleFollowUpExpiry(0);
          return;
        }

        if (!isConnected || !getRealtimeSessionToken()) {
          setAssistantBubbleText('Not connected to the assistant service yet');
          setAssistantBubbleStatus('done');
          setState('follow_up');
          scheduleFollowUpExpiry(0);
          return;
        }

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
          if (isAbortError(e) || abortController.signal.aborted) return;
          const message = e instanceof Error ? e.message : 'Command failed';
          setAssistantBubbleText(message);
          setAssistantBubbleStatus('done');
          setState('follow_up');
          scheduleFollowUpExpiry(message.length);
        } finally {
          streamAbortRef.current = null;
        }
      })();
    },
    [
      abortActiveStream,
      claimAssistantMode,
      clearFollowUpTimer,
      getAccessToken,
      handleStreamEvent,
      isConnected,
      scheduleFollowUpExpiry,
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
          startNewTurn();
          setState('listening');
          void (async () => {
            await claimAssistantMode();
          })();
          scheduleWakeFalsePositiveRelease();
          const visible = normalizeVisibleCommandText(text);
          if (visible) setUserBubbleText(visible);
          return;
        }

        if (current === 'listening') {
          const visible = followUpCaptureRef.current
            ? text.trim()
            : normalizeVisibleCommandText(text);
          if (visible) setUserBubbleText(visible);
          return;
        }

        if (current === 'follow_up') {
          if (!text.trim()) return;
          pauseFollowUpTimer();
          followUpCaptureRef.current = true;
          const visible = text.trim();
          if (visible) setUserBubbleText(visible);
        }
        return;
      }

      if (msg.event === 'command_transcript_final') {
        if (current === 'thinking' || current === 'responding') return;
        const finalRaw = cleanTranscript(typeof msg.text === 'string' ? msg.text : '');
        const text = finalRaw || lastWakeInterimRef.current;
        lastWakeInterimRef.current = '';
        clearWakeTimeout();

        if (current === 'idle') {
          if (!text.trim() || !transcriptStartsWithWakeCommand(text)) return;
          startNewTurn();
          setState('listening');
          void (async () => {
            const claimed = await claimAssistantMode();
            if (!claimed) return;
            scheduleWakeFalsePositiveRelease();
            const visible = normalizeVisibleCommandText(text);
            if (visible) {
              submitVisibleCommandText(text, false);
            }
          })();
          return;
        }

        if (current === 'listening') {
          if (!text.trim()) return;
          const fromFollowUp = followUpCaptureRef.current;
          followUpCaptureRef.current = false;
          submitVisibleCommandText(text, fromFollowUp);
          return;
        }

        if (current === 'follow_up') {
          if (!text.trim()) return;
          followUpCaptureRef.current = false;
          submitVisibleCommandText(text, true);
          return;
        }
      }
    });
    return off;
  }, [
    claimAssistantMode,
    clearWakeTimeout,
    pauseFollowUpTimer,
    scheduleWakeFalsePositiveRelease,
    startNewTurn,
    submitVisibleCommandText,
  ]);

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
    activeToolCall,
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
