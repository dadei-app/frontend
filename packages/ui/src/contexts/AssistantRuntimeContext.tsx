import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { assistantRuntimeReducer } from '@dadei/ui/lib/assistant/runtime/reducer';
import {
  INITIAL_ASSISTANT_RUNTIME,
  type AssistantRuntimeAction,
  type AssistantRuntimeState,
} from '@dadei/ui/lib/assistant/runtime/types';

interface AssistantRuntimeContextValue {
  state: AssistantRuntimeState;
  dispatch: Dispatch<AssistantRuntimeAction>;
}

const AssistantRuntimeContext = createContext<AssistantRuntimeContextValue | undefined>(undefined);

export function AssistantRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(assistantRuntimeReducer, INITIAL_ASSISTANT_RUNTIME);

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

export function useAssistantRuntimeDispatch(): Dispatch<AssistantRuntimeAction> {
  return useAssistantRuntime().dispatch;
}

export function useAssistantRuntimeState(): AssistantRuntimeState {
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
      syncCommandMode: (payload: {
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
      setCommandPhase: (phase: AssistantRuntimeState['command']) =>
        dispatch({ type: 'command/phase', phase }),
      setCommandSubmode: (submode: AssistantRuntimeState['submode']) =>
        dispatch({ type: 'command/submode', submode }),
      resetRuntime: () => dispatch({ type: 'runtime/reset' }),
    }),
    [dispatch],
  );
}
