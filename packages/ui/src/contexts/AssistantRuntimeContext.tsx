import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { assistantRuntimeReducer } from '@dadei/ui/lib/assistant/assistantRuntime';
import {
  applyAssistantStateSnapshot,
  beginServiceStateSyncPending,
  clearServiceStateSyncPending,
  resetAssistantLifecycle,
  runServiceStateMutation,
  waitForServiceStateRevisionAfter,
  type AssistantStateSnapshot,
} from '@dadei/ui/lib/assistant/lifecycle/assistantLifecycle';
import {
  INITIAL_ASSISTANT_STATE,
  type AssistantAction,
  type AssistantState,
} from '@dadei/ui/types/assistant.types';
import type { CommandMode, CommandState } from '@dadei/ui/types/command.types';

interface AssistantRuntimeContextValue {
  state: AssistantState;
  dispatch: Dispatch<AssistantAction>;
  applyAuthoritativeState: (snapshot: AssistantStateSnapshot) => boolean;
}

const AssistantRuntimeContext = createContext<AssistantRuntimeContextValue | undefined>(undefined);

export function AssistantRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(assistantRuntimeReducer, INITIAL_ASSISTANT_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const applyAuthoritativeState = useCallback((snapshot: AssistantStateSnapshot) => {
    return applyAssistantStateSnapshot(dispatch, snapshot, stateRef.current);
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, applyAuthoritativeState }),
    [applyAuthoritativeState, state],
  );

  return (
    <AssistantRuntimeContext.Provider value={value}>{children}</AssistantRuntimeContext.Provider>
  );
}

export function useAssistantRuntime(): AssistantRuntimeContextValue {
  const ctx = useContext(AssistantRuntimeContext);
  if (!ctx) {
    throw new Error('useAssistantRuntime must be used within AssistantRuntimeProvider');
  }
  return ctx;
}

export function useAssistantRuntimeDispatch(): Dispatch<AssistantAction> {
  return useAssistantRuntime().dispatch;
}

export function useAssistantRuntimeState(): AssistantState {
  return useAssistantRuntime().state;
}

export function useApplyAuthoritativeAssistantState(): AssistantRuntimeContextValue['applyAuthoritativeState'] {
  return useAssistantRuntime().applyAuthoritativeState;
}

/** Stable dispatch helpers for service / command integration. */
export function useAssistantRuntimeActions() {
  const { dispatch } = useAssistantRuntime();

  return useMemo(
    () => ({
      setNetworkConnected: (connected: boolean) => {
        dispatch({ type: connected ? 'network/connected' : 'network/disconnected' });
      },
      setRegistrationConflict: () => dispatch({ type: 'network/registration_conflict' }),
      beginServiceStateSyncPending: (baselineRevision: number) =>
        beginServiceStateSyncPending(dispatch, baselineRevision),
      clearServiceStateSyncPending: () => clearServiceStateSyncPending(dispatch),
      runServiceStateMutation: (options: {
        baselineRevision: number;
        micPending?: boolean;
        mutation: () => Promise<void>;
      }) =>
        runServiceStateMutation({
          dispatch,
          baselineRevision: options.baselineRevision,
          micPending: options.micPending,
          mutation: options.mutation,
        }),
      waitForServiceStateRevisionAfter: (baselineRevision: number) =>
        waitForServiceStateRevisionAfter(baselineRevision),
      setCommandState: (commandState: CommandState) =>
        dispatch({ type: 'command/state', commandState }),
      setCommandMode: (commandMode: CommandMode) =>
        dispatch({ type: 'command/mode', commandMode }),
      setCommandThinkingActive: (active: boolean) =>
        dispatch({ type: 'command/thinking_active', active }),
      setCommandCaptureSyncPending: (pending: boolean) =>
        dispatch({ type: 'command/capture_sync_pending', pending }),
      resetRuntime: () => {
        resetAssistantLifecycle();
        dispatch({ type: 'runtime/reset' });
      },
    }),
    [dispatch],
  );
}
