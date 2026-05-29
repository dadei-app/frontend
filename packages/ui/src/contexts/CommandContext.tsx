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
  streamCommandFromText,
  type CommandSSEEvent,
} from '@dadei/ui/lib/api/command';
import { serviceApi } from '@dadei/ui/lib/api/service';
import { getRealtimeSessionToken } from '@dadei/ui/lib/realtimeClient';
import { subscribeRealtimeMessages } from '@dadei/ui/lib/realtimeClient';
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
    void claimAssistantMode();
    scheduleWakeFalsePositiveRelease();
  }, [claimAssistantMode, scheduleWakeFalsePositiveRelease, startNewTurn]);

  const handleStreamEvent = useCallback(
    (ev: CommandSSEEvent) => {
      switch (ev.type) {
        case 'transcript':
          setUserBubbleText(ev.text);
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
          setState('follow_up');
          scheduleFollowUpExpiry(assistantBubbleTextRef.current.length);
          break;
        default:
          break;
      }
    },
    [scheduleFollowUpExpiry],
  );

  const submitVisibleCommandText = useCallback(
    (raw: string, fromFollowUp: boolean) => {
      const visible = fromFollowUp ? raw.trim() : normalizeVisibleCommandText(raw);
      if (!visible) return;
      const nowMs = Date.now();
      const last = lastSubmittedTextRef.current;
      if (last && last.text === visible && nowMs - last.atMs < 1500) return;
      lastSubmittedTextRef.current = { text: visible, atMs: nowMs };

      clearWakeTimeout();
      setUserBubbleText(visible);
      setAssistantBubbleText('');
      setAssistantBubbleStatus('pending');
      setActiveToolCall(undefined);
      setState('thinking');

      void (async () => {
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
            if (ev.type === 'done') sawDone = true;
            handleStreamEvent(ev);
          }
          if (
            !sawDone &&
            (stateRef.current === 'responding' || stateRef.current === 'thinking')
          ) {
            handleStreamEvent({ type: 'done' });
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
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
        const text = typeof msg.text === 'string' ? msg.text : '';
        if (!text) return;

        if (current === 'idle' && transcriptStartsWithWakeCommand(text)) {
          lastWakeInterimRef.current = text;
          startNewTurn();
          setState('listening');
          void claimAssistantMode();
          scheduleWakeFalsePositiveRelease();
          const visible = normalizeVisibleCommandText(text);
          if (visible) setUserBubbleText(visible);
          return;
        }

        if (current === 'listening') {
          const visible = normalizeVisibleCommandText(text);
          if (visible) setUserBubbleText(visible);
          return;
        }

        if (current === 'follow_up') {
          setUserBubbleText(text.trim());
        }
        return;
      }

      if (msg.event === 'command_transcript_final') {
        if (current === 'thinking' || current === 'responding') return;
        const finalRaw = typeof msg.text === 'string' ? msg.text : '';
        const text = finalRaw || lastWakeInterimRef.current;
        lastWakeInterimRef.current = '';
        clearWakeTimeout();

        if (current === 'listening') {
          if (!text.trim()) return;
          submitVisibleCommandText(text, false);
          return;
        }

        if (current === 'follow_up') {
          if (!text.trim()) return;
          startNewTurn();
          submitVisibleCommandText(text, true);
        }
      }
    });
    return off;
  }, [
    claimAssistantMode,
    clearWakeTimeout,
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
