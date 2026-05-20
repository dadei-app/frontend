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
import {
  streamCommand,
  streamCommandFromText,
  type CommandSSEEvent,
} from '@dadei/ui/lib/api/command';
import { serviceApi } from '@dadei/ui/lib/api/service';
import { getRealtimeSessionToken } from '@dadei/ui/lib/realtimeClient';

export type CommandMode = 'passive' | 'capturing' | 'streaming' | 'done';

interface CommandContextValue {
  mode: CommandMode;
  transcript: string;
  responseTokens: string[];
  activeToolCall: string | undefined;
  submitCommandAudio: (wav: ArrayBuffer, options?: { claimAssistantMode?: boolean }) => void;
  submitCommandText: (text: string, options?: { claimAssistantMode?: boolean }) => void;
  setInterimTranscript: (text: string) => void;
  dismiss: () => void;
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined);
const ASSISTANT_WINDOW_MS = 12000;
const ASSISTANT_HOLD_SECONDS = 12;

const TOOL_LABELS: Record<string, string> = {
  create_calendar_event: 'Creating calendar event',
  create_reminder: 'Creating reminder',
  create_task: 'Creating task',
  store_memory: 'Saving memory',
  search_memory: 'Searching memory',
  get_current_time: 'Getting time',
  send_email: 'Sending email',
  web_search: 'Searching the web',
};

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

export function CommandProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const {
    isConnected,
    isServiceEnabled,
    isAssistantMode,
    isAssistantOwner,
  } = useService();

  const [mode, setMode] = useState<CommandMode>('passive');
  const [transcript, setTranscript] = useState('');
  const [responseTokens, setResponseTokens] = useState<string[]>([]);
  const [activeToolCall, setActiveToolCall] = useState<string | undefined>(undefined);

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const localAssistantOwnershipRef = useRef(false);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current != null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const clearAssistantReleaseTimer = useCallback(() => {
    if (assistantReleaseTimerRef.current != null) {
      clearTimeout(assistantReleaseTimerRef.current);
      assistantReleaseTimerRef.current = null;
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
      localAssistantOwnershipRef.current = false;
      return true;
    } catch (error) {
      console.warn('[Command] Failed to release assistant mode', error);
      return false;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    clearAssistantReleaseTimer();
    abortActiveStream();
    localAssistantOwnershipRef.current = false;
    setMode('passive');
    setTranscript('');
    setResponseTokens([]);
    setActiveToolCall(undefined);
  }, [abortActiveStream, clearAssistantReleaseTimer, clearDismissTimer]);

  const schedulePostDoneCleanup = useCallback(() => {
    clearDismissTimer();
    clearAssistantReleaseTimer();

    if (localAssistantOwnershipRef.current || (isAssistantMode && isAssistantOwner)) {
      assistantReleaseTimerRef.current = setTimeout(() => {
        void (async () => {
          const released = await releaseAssistantMode();
          if (!released) {
            try {
              await serviceApi.enable();
            } catch (error) {
              console.warn('[Command] Failed to recover service after release failure', error);
            }
          }
          dismiss();
        })();
      }, ASSISTANT_WINDOW_MS);
      return;
    }

    dismissTimerRef.current = setTimeout(() => {
      dismiss();
    }, ASSISTANT_WINDOW_MS);
  }, [
    clearAssistantReleaseTimer,
    clearDismissTimer,
    dismiss,
    isAssistantMode,
    isAssistantOwner,
    releaseAssistantMode,
  ]);

  const handleEvent = useCallback(
    (ev: CommandSSEEvent) => {
      switch (ev.type) {
        case 'transcript':
          setTranscript(ev.text);
          setMode('streaming');
          break;
        case 'token':
          setResponseTokens((prev) => [...prev, ev.text]);
          break;
        case 'tool_call':
          setActiveToolCall(toolLabel(ev.tool));
          break;
        case 'tool_result':
          setActiveToolCall(undefined);
          break;
        case 'error':
          setTranscript(ev.message);
          setMode('done');
          break;
        case 'done':
          setMode('done');
          schedulePostDoneCleanup();
          break;
        default:
          break;
      }
    },
    [schedulePostDoneCleanup],
  );

  const runCommandPipeline = useCallback(
    (
      request:
        | { kind: 'audio'; wav: ArrayBuffer }
        | { kind: 'text'; text: string },
      options?: { claimAssistantMode?: boolean },
    ) => {
      abortActiveStream();
      clearAssistantReleaseTimer();
      clearDismissTimer();
      setMode('capturing');
      setTranscript('');
      setResponseTokens([]);
      setActiveToolCall(undefined);

      void (async () => {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setTranscript('Not authenticated');
          setMode('done');
          schedulePostDoneCleanup();
          return;
        }

        const sessionToken = getRealtimeSessionToken();
        if (!isConnected || !sessionToken) {
          handleEvent({ type: 'error', message: 'Not connected to the assistant service yet' });
          return;
        }

        if (options?.claimAssistantMode) {
          try {
            await serviceApi.claimAssistantMode(sessionToken, ASSISTANT_HOLD_SECONDS);
            localAssistantOwnershipRef.current = true;
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Another device owns assistant mode';
            handleEvent({ type: 'error', message });
            handleEvent({ type: 'done' });
            return;
          }
        } else if (isAssistantMode && isAssistantOwner) {
          // Follow-up turns inside the same 5s conversational window should still release service.
          localAssistantOwnershipRef.current = true;
        } else if (isAssistantMode && !isAssistantOwner) {
          handleEvent({
            type: 'error',
            message: 'Another device is currently handling assistant mode',
          });
          handleEvent({ type: 'done' });
          return;
        }

        try {
          const abortController = new AbortController();
          streamAbortRef.current = abortController;
          const stream =
            request.kind === 'audio'
              ? streamCommand(request.wav, accessToken, {
                  signal: abortController.signal,
                })
              : streamCommandFromText(request.text, accessToken, {
                  signal: abortController.signal,
                });
          for await (const ev of stream) {
            handleEvent(ev);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') {
            return;
          }
          const message = e instanceof Error ? e.message : 'Command failed';
          handleEvent({ type: 'error', message });
        } finally {
          streamAbortRef.current = null;
        }
      })();
    },
    [
      abortActiveStream,
      clearAssistantReleaseTimer,
      clearDismissTimer,
      getAccessToken,
      handleEvent,
      isAssistantMode,
      isAssistantOwner,
      isConnected,
      schedulePostDoneCleanup,
    ],
  );

  const submitCommandAudio = useCallback(
    (wav: ArrayBuffer, options?: { claimAssistantMode?: boolean }) => {
      runCommandPipeline({ kind: 'audio', wav }, options);
    },
    [runCommandPipeline],
  );

  const submitCommandText = useCallback(
    (text: string, options?: { claimAssistantMode?: boolean }) => {
      runCommandPipeline({ kind: 'text', text }, options);
    },
    [runCommandPipeline],
  );

  const setInterimTranscript = useCallback((text: string) => {
    if (!text.trim()) return;
    setMode((prev) => (prev === 'passive' ? 'capturing' : prev));
    setTranscript(text);
  }, []);

  useEffect(() => {
    if (mode === 'passive') return;
    if (isAssistantMode && !isAssistantOwner) {
      abortActiveStream();
      dismiss();
    }
  }, [abortActiveStream, dismiss, isAssistantMode, isAssistantOwner, mode]);

  useEffect(() => {
    if (mode === 'passive') return;
    if (isAssistantMode && isServiceEnabled) {
      abortActiveStream();
      dismiss();
    }
  }, [abortActiveStream, dismiss, isAssistantMode, isServiceEnabled, mode]);

  useEffect(
    () => () => {
      clearDismissTimer();
      clearAssistantReleaseTimer();
      abortActiveStream();
    },
    [abortActiveStream, clearAssistantReleaseTimer, clearDismissTimer],
  );

  const value: CommandContextValue = {
    mode,
    transcript,
    responseTokens,
    activeToolCall,
    submitCommandAudio,
    submitCommandText,
    setInterimTranscript,
    dismiss,
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
