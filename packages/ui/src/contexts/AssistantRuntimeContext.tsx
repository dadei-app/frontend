import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { assistantRuntimeReducer } from '@dadei/ui/lib/assistant/assistantRuntime';
import {
  INITIAL_ASSISTANT_STATE,
  type AssistantAction,
  type AssistantState,
} from '@dadei/ui/types/assistant.types';

interface AssistantRuntimeContextValue {
  state: AssistantState;
  dispatch: Dispatch<AssistantAction>;
}

const AssistantRuntimeContext = createContext<AssistantRuntimeContextValue | undefined>(undefined);

export function AssistantRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(assistantRuntimeReducer, INITIAL_ASSISTANT_STATE);

  const value = useMemo(() => ({ state, dispatch }), [state]);

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

/** Stable dispatch helpers for service / command integration. */
export function useAssistantRuntimeActions() {
  const { dispatch } = useAssistantRuntime();

  return useMemo(
    () => ({
      setNetworkConnected: (connected: boolean) => {
        dispatch({ type: connected ? 'network/connected' : 'network/disconnected' });
      },
      setRegistrationConflict: () => dispatch({ type: 'network/registration_conflict' }),
      setServiceToggling: (toggling: boolean) =>
        dispatch({ type: 'service/toggling', toggling }),
      setServiceStatus: (enabled: boolean) => dispatch({ type: 'service/status', enabled }),
      syncCommandService: (payload: {
        active: boolean;
        ownerSessionId: string | null;
        expiresAt: string | null;
      }) =>
        dispatch({
          type: 'command/sync',
          active: payload.active,
          ownerSessionId: payload.ownerSessionId,
          expiresAt: payload.expiresAt,
        }),
      setCommandState: (commandState: AssistantState['commandState']) =>
        dispatch({ type: 'command/state', commandState }),
      setCommandMode: (commandMode: AssistantState['commandMode']) =>
        dispatch({ type: 'command/mode', commandMode }),
      resetRuntime: () => dispatch({ type: 'runtime/reset' }),
    }),
    [dispatch],
  );
}
