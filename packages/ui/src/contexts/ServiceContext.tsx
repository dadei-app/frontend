import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import {
  useAssistantRuntimeActions,
  useAssistantRuntimeState,
  useApplyAuthoritativeAssistantState,
} from '@dadei/ui/contexts/AssistantRuntimeContext';
import {
  selectIsAmbientEnabled,
  selectIsCommandService,
  selectIsCommandOwner,
  selectIsMicSyncPending,
  selectIsServiceStateSyncPending,
} from '@dadei/ui/lib/assistant/assistantRuntime';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { parseInteractionDate } from '@dadei/ui/components/interaction-panel/conversationUtils';
import { getUserErrorMessage, ERROR_CODES } from '@dadei/ui/lib/platform/errors/userMessage';
import { actionsApi } from '@dadei/ui/lib/workspace/api/actions';
import { memoriesApi } from '@dadei/ui/lib/workspace/api/memories';
import { personsApi } from '@dadei/ui/lib/workspace/api/persons';
import { conversationsApi } from '@dadei/ui/lib/workspace/api/conversations';
import { interactionsApi } from '@dadei/ui/lib/workspace/api/interactions';
import { serviceApi } from '@dadei/ui/lib/workspace/api/service';
import {
  parseAssistantStateWireMessage,
  runAssistantTransition,
  type AssistantStateSnapshot,
} from '@dadei/ui/lib/assistant/lifecycle/assistantLifecycle';
import {
  startRealtimeClient,
  stopRealtimeClient,
  subscribeRealtimeMessages,
} from '@dadei/ui/lib/assistant/realtime/realtimeClient';
import { getRealtimeSessionId } from '@dadei/ui/lib/assistant/realtime/realtimeClient';
import {
  clearAssistantSessionCaches,
  removePersonFromCaches,
} from '@dadei/ui/lib/platform/query/cacheUtils';
import {
  ASSISTANT_MEMORIES_LIST_LIMIT,
  conversationQueryOptions,
  INTERACTION_PANEL_RECENT_LIMIT,
  useAuthMeQuery,
} from '@dadei/ui/lib/platform/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';
import {
  areRequiredPermissionsGranted,
  hasMissingClientPermissions,
  toTutorialPlatform,
} from '@dadei/ui/lib/onboarding/tutorial/permissionsRegistry';
import type {
  Conversation,
  EpisodicMemory,
  Interaction,
  NetworkAction,
  Person,
} from '@dadei/ui/types/models.types';

function isNetworkAction(data: unknown): data is NetworkAction {
  if (!data || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.action_type === 'string' &&
    typeof o.status === 'string'
  );
}

function isNetworkActionQueue(data: unknown): data is NetworkAction[] {
  return Array.isArray(data) && data.every(isNetworkAction);
}

function sortInteractionsByTime(rows: Interaction[]): Interaction[] {
  return [...rows].sort(
    (a, b) =>
      parseInteractionDate(a.timestamp).getTime() - parseInteractionDate(b.timestamp).getTime(),
  );
}

function sortConversationsByRecency(rows: Conversation[]): Conversation[] {
  return [...rows].sort(
    (a, b) =>
      parseInteractionDate(b.started_at).getTime() - parseInteractionDate(a.started_at).getTime(),
  );
}

function patchInteractionList(
  prev: Interaction[] | undefined,
  interaction: Interaction,
  limit: number,
): Interaction[] {
  if (!prev) return [interaction];
  if (prev.some(item => item.id === interaction.id)) {
    return sortInteractionsByTime(
      prev.map(item => (item.id === interaction.id ? { ...item, ...interaction } : item)),
    );
  }
  return sortInteractionsByTime([interaction, ...prev]).slice(0, limit);
}

interface ServiceContextType {
  /** True once realtime is connected and initial conversations/persons have loaded. */
  isReady: boolean;
  isServiceEnabled: boolean;
  isConnected: boolean;
  registrationConflict: boolean;
  clientName: string;
  toggleService: () => Promise<void>;
  /** Mic loading — awaiting authoritative `assistant_state` after a service mutation. */
  serviceStateSyncPending: boolean;
  isCommandService: boolean;
  isCommandOwner: boolean;
  commandOwnerSessionId: string | null;
  commandServiceExpiresAt: string | null;
  commandServiceRemainingMs: number;

  memories: EpisodicMemory[];
  memoriesLoading: boolean;
  deleteMemory: (id: string) => Promise<void>;
  isDeletingMemory: boolean;

  actions: NetworkAction[];
  actionsLoading: boolean;
  rejectAction: (id: string) => Promise<void>;

  persons: Person[];
  personsLoading: boolean;
  refetchPersons: () => void;
  renamePerson: (personId: string, name: string) => Promise<Person>;
  isRenamingPerson: boolean;
  deletePerson: (personId: string) => Promise<void>;
  isDeletingPerson: boolean;
  recentConversations: Conversation[];
  bootstrapInteractions: Interaction[];
  interactionsLoading: boolean;
  interactionsError: unknown;
  retryInteractions: () => void;
  conversationIdsKey: string;
  pruneExtraBootstrapConversationId: (conversationId: string) => void;
  clearExtraBootstrapConversationIds: () => void;

  permissionsGateOpen: boolean;
  permissionsGateIntent: 'enable' | 'active-service' | null;
  completePermissionsGate: () => Promise<void>;
  dismissPermissionsGate: () => void;
}

export const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, getAccessToken } = useAuth();
  const { showToast } = useNotifications();
  const { isElectron, platform } = useSystem();
  const queryClient = useQueryClient();
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const meQuery = useAuthMeQuery(isAuthenticated && !isAuthLoading);
  const tutorialIncomplete = Boolean(meQuery.data && !meQuery.data.tutorial_completed);
  const tutorialIncompleteRef = useRef(tutorialIncomplete);
  tutorialIncompleteRef.current = tutorialIncomplete;
  const tutorialServiceDisableAttemptedRef = useRef(false);

  const runtimeActions = useAssistantRuntimeActions();
  const runtime = useAssistantRuntimeState();
  const applyAuthoritativeState = useApplyAuthoritativeAssistantState();
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  const isServiceEnabled = selectIsAmbientEnabled(runtime);
  const isConnected = runtime.isConnected;
  const serviceStateSyncPending = selectIsServiceStateSyncPending(runtime);
  const registrationConflict = runtime.registrationConflict;
  const isCommandService = selectIsCommandService(runtime);
  const commandOwnerSessionId = runtime.commandOwnerSessionId;
  const commandServiceExpiresAt = runtime.commandServiceExpiresAt;

  const [clientName, setClientName] = useState('');
  const [extraBootstrapConversationIds, setExtraBootstrapConversationIds] = useState<string[]>([]);
  const [actions, setActions] = useState<NetworkAction[]>([]);
  const [permissionsGateOpen, setPermissionsGateOpen] = useState(false);
  const [permissionsGateIntent, setPermissionsGateIntent] = useState<
    'enable' | 'active-service' | null
  >(null);
  const permissionsGateIntentRef = useRef<'enable' | 'active-service' | null>(null);
  const pendingEnableRef = useRef(false);

  const sessionReady = isAuthenticated && isConnected;
  const recentIdsRef = useRef<string[]>([]);

  const memoriesQuery = useQuery({
    queryKey: queryKeys.memoriesList(ASSISTANT_MEMORIES_LIST_LIMIT),
    queryFn: () => memoriesApi.list({ limit: ASSISTANT_MEMORIES_LIST_LIMIT }),
    enabled: sessionReady,
    staleTime: Infinity,
    refetchOnMount: false,
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => memoriesApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<EpisodicMemory[]>(
        queryKeys.memoriesList(ASSISTANT_MEMORIES_LIST_LIMIT),
        prev => (prev ? prev.filter(m => m.id !== id) : prev),
      );
    },
  });

  const personsQuery = useQuery({
    queryKey: queryKeys.persons,
    queryFn: () => personsApi.getAll(),
    enabled: sessionReady,
    staleTime: Infinity,
    refetchOnMount: false,
  });

  const renamePersonMutation = useMutation({
    mutationFn: ({ personId, name }: { personId: string; name: string }) =>
      personsApi.update(personId, { name }),
    onMutate: async ({ personId, name }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.persons });
      const previous = queryClient.getQueryData<Person[]>(queryKeys.persons);
      if (previous) {
        queryClient.setQueryData<Person[]>(
          queryKeys.persons,
          previous.map(p => (p.id === personId ? { ...p, name } : p)),
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKeys.persons, ctx.previous);
    },
    onSuccess: updated => {
      queryClient.setQueryData<Person[]>(queryKeys.persons, prev =>
        (prev ?? []).map(p => (p.id === updated.id ? updated : p)),
      );
      queryClient.setQueryData(queryKeys.personById(updated.id), updated);
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: (personId: string) => personsApi.delete(personId),
    onSuccess: (_data, personId) => {
      queryClient.setQueryData<Person[]>(queryKeys.persons, prev =>
        (prev ?? []).filter(p => p.id !== personId),
      );
      queryClient.removeQueries({ queryKey: queryKeys.personById(personId) });
      removePersonFromCaches(queryClient, personId, cid => {
        setExtraBootstrapConversationIds(prev => prev.filter(x => x.trim() !== cid));
      });
    },
  });

  const recentConversationsQuery = useQuery({
    queryKey: queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
    queryFn: async (): Promise<Conversation[]> => {
      const rows = await conversationsApi.getRecent(INTERACTION_PANEL_RECENT_LIMIT, 0);
      for (const c of rows) {
        queryClient.setQueryData<Conversation>(queryKeys.conversationById(c.id), c);
      }
      return rows;
    },
    enabled: sessionReady,
    staleTime: Infinity,
    refetchOnMount: false,
  });

  const recentIds = useMemo(
    () => (recentConversationsQuery.data ?? []).map(c => c.id),
    [recentConversationsQuery.data],
  );

  useEffect(() => {
    recentIdsRef.current = recentIds;
  }, [recentIds]);

  const allBootstrapIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of recentIds) {
      const t = id?.trim();
      if (t) ids.add(t);
    }
    for (const id of extraBootstrapConversationIds) {
      const t = id?.trim();
      if (t) ids.add(t);
    }
    return Array.from(ids).sort();
  }, [extraBootstrapConversationIds, recentIds]);

  const conversationIdsKey = useMemo(() => allBootstrapIds.join('\u001f'), [allBootstrapIds]);

  const bootstrapReady =
    sessionReady &&
    (recentConversationsQuery.isSuccess || recentConversationsQuery.isError);

  const bootstrapInteractionsQuery = useQuery({
    queryKey: queryKeys.interactionsBootstrap(conversationIdsKey),
    queryFn: () =>
      interactionsApi.getBootstrapForConversations(allBootstrapIds, {
        limit: INTERACTION_PANEL_RECENT_LIMIT,
      }),
    enabled: bootstrapReady && allBootstrapIds.length > 0,
    staleTime: Infinity,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!sessionReady) {
      setActions([]);
      return;
    }
    const sync = () => {
      setActions(queryClient.getQueryData<NetworkAction[]>(queryKeys.actions) ?? []);
    };
    sync();
    return queryClient.getQueryCache().subscribe(event => {
      if (event?.query?.queryKey?.[0] !== queryKeys.actions[0]) return;
      if (event.type === 'updated' || event.type === 'added') {
        sync();
      }
    });
  }, [sessionReady, queryClient]);

  useEffect(() => {
    if (!isConnected) {
      setExtraBootstrapConversationIds([]);
    }
  }, [isConnected]);

  const trackExtraBootstrapConversation = useCallback((interaction: Interaction) => {
    const convId = interaction.conversation_id?.trim();
    if (!convId) return;
    setExtraBootstrapConversationIds(prev => {
      if (prev.some(x => x.trim() === convId)) return prev;
      if (recentIdsRef.current.some(x => x.trim() === convId)) return prev;
      return [...prev, convId];
    });
  }, []);

  const checkRequiredPermissions = useCallback(async () => {
    const tutorialPlatform = toTutorialPlatform(platform, isElectron);
    return areRequiredPermissionsGranted(tutorialPlatform, isElectron);
  }, [platform, isElectron]);

  const openPermissionsGate = useCallback((intent: 'enable' | 'active-service') => {
    permissionsGateIntentRef.current = intent;
    setPermissionsGateIntent(intent);
    setPermissionsGateOpen(true);
  }, []);

  const dismissPermissionsGate = useCallback(() => {
    pendingEnableRef.current = false;
    permissionsGateIntentRef.current = null;
    setPermissionsGateOpen(false);
    setPermissionsGateIntent(null);
    runtimeActions.clearServiceStateSyncPending();
  }, [runtimeActions]);

  const completePermissionsGate = useCallback(async () => {
    const intent = permissionsGateIntentRef.current;
    const shouldEnable = intent === 'enable' || pendingEnableRef.current;
    pendingEnableRef.current = false;
    permissionsGateIntentRef.current = null;
    setPermissionsGateOpen(false);
    setPermissionsGateIntent(null);

    if (!shouldEnable) return;

    await runAssistantTransition(async () => {
      const baseline = runtimeRef.current.serviceStateRevision;
      try {
        await runtimeActions.runServiceStateMutation({
          baselineRevision: baseline,
          micPending: true,
          mutation: () => serviceApi.enable(),
        });
      } catch (error) {
        console.error('Failed to enable service after permissions:', error);
        showToast(getUserErrorMessage(error, 'Could not enable assistant service.'), 'error');
      }
    });
  }, [runtimeActions, showToast]);

  const maybePromptForActiveServicePermissions = useCallback(
    async (enabled: boolean) => {
      if (!enabled || permissionsGateOpen) return;
      const missingRequired = !(await checkRequiredPermissions());
      if (missingRequired) {
        openPermissionsGate('active-service');
      }
    },
    [checkRequiredPermissions, openPermissionsGate, permissionsGateOpen],
  );

  const handleAssistantStateSnapshot = useCallback(
    (snapshot: AssistantStateSnapshot) => {
      if (
        tutorialIncompleteRef.current &&
        snapshot.ambientEnabled &&
        !snapshot.commandModeActive
      ) {
        console.log('[Service] Ignoring enabled status during tutorial');
        void serviceApi.disable().catch(error => {
          console.error('Failed to disable service for tutorial:', error);
        });
        return false;
      }
      const applied = applyAuthoritativeState(snapshot);
      if (applied && snapshot.ambientEnabled && !snapshot.commandModeActive) {
        void maybePromptForActiveServicePermissions(true);
      }
      return applied;
    },
    [applyAuthoritativeState, maybePromptForActiveServicePermissions],
  );

  useEffect(() => {
    if (!isServiceEnabled || !sessionReady || permissionsGateOpen) return;
    void maybePromptForActiveServicePermissions(true);
  }, [isServiceEnabled, maybePromptForActiveServicePermissions, permissionsGateOpen, sessionReady]);

  useEffect(() => {
    if (!tutorialIncomplete) {
      tutorialServiceDisableAttemptedRef.current = false;
      return;
    }
    if (!isConnected) return;
    if (tutorialServiceDisableAttemptedRef.current) return;
    tutorialServiceDisableAttemptedRef.current = true;

    void runAssistantTransition(async () => {
      try {
        await serviceApi.disable();
      } catch (error) {
        console.error('Failed to disable service for tutorial:', error);
        tutorialServiceDisableAttemptedRef.current = false;
      }
    });
  }, [isConnected, tutorialIncomplete]);

  useEffect(() => {
    if (!isAuthenticated) {
      stopRealtimeClient();
      runtimeActions.resetRuntime();
      setExtraBootstrapConversationIds([]);
      permissionsGateIntentRef.current = null;
      setPermissionsGateOpen(false);
      setPermissionsGateIntent(null);
      clearAssistantSessionCaches(queryClient);
    }
  }, [isAuthenticated, queryClient, runtimeActions]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      runtimeActions.setNetworkConnected(false);
      return;
    }

    let cancelled = false;

    const connectRealtime = async () => {
      try {
        if (cancelled) return;
        runtimeActions.setNetworkConnected(true);
        startRealtimeClient({
          getAccessToken: () => getAccessTokenRef.current(),
        });
      } catch (error: unknown) {
        console.error('Failed to start realtime client:', error);
        runtimeActions.setRegistrationConflict();
        runtimeActions.setNetworkConnected(false);
        stopRealtimeClient();
        showToast(getUserErrorMessage(error, ERROR_CODES.invalid_session), 'error');
      }
    };

    void connectRealtime();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthLoading, runtimeActions, showToast]);

  useEffect(() => {
    const handleAssistantStateChanged = (msg: Record<string, unknown>) => {
      const snapshot = parseAssistantStateWireMessage(msg);
      if (!snapshot) return;
      console.log('[Service] assistant_state revision', snapshot.revision);
      handleAssistantStateSnapshot(snapshot);
    };

    function handleInteraction(data: unknown) {
      if (!data || typeof data !== 'object') return;
      const interaction = data as Interaction;
      if (!interaction.id) return;

      queryClient.setQueriesData<Interaction[]>(
        { queryKey: [...queryKeys.interactions, 'bootstrap'] },
        prev => patchInteractionList(prev, interaction, INTERACTION_PANEL_RECENT_LIMIT),
      );
      queryClient.setQueryData<Interaction[]>(queryKeys.interactions, prev => {
        if (!prev) return undefined;
        return patchInteractionList(prev, interaction, prev.length);
      });

      const convId = interaction.conversation_id?.trim();
      if (convId) {
        void queryClient.prefetchQuery(conversationQueryOptions(convId));
        trackExtraBootstrapConversation(interaction);
      }
    }

    function handleConversation(data: unknown) {
      if (!data || typeof data !== 'object') return;
      const conv = data as Conversation;
      if (!conv.id) return;

      queryClient.setQueryData<Conversation>(queryKeys.conversationById(conv.id), conv);
      queryClient.setQueryData<Conversation[]>(
        queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
        prev => {
          if (!prev) return [conv];
          const idx = prev.findIndex(c => c.id === conv.id);
          const next =
            idx === -1
              ? [conv, ...prev]
              : prev.map((c, i) => (i === idx ? { ...c, ...conv } : c));
          return sortConversationsByRecency(next).slice(0, INTERACTION_PANEL_RECENT_LIMIT);
        },
      );
    }

    function handleMemory(data: unknown) {
      if (!data || typeof data !== 'object') return;
      const memory = data as EpisodicMemory;
      if (!memory.id) return;

      const listKey = queryKeys.memoriesList(ASSISTANT_MEMORIES_LIST_LIMIT);
      queryClient.setQueryData<EpisodicMemory[]>(listKey, prev => {
        if (!prev) return [memory];
        if (memory.status === 'deleted') {
          return prev.filter(m => m.id !== memory.id);
        }
        const idx = prev.findIndex(m => m.id === memory.id);
        if (idx === -1) return [memory, ...prev].slice(0, ASSISTANT_MEMORIES_LIST_LIMIT);
        const next = [...prev];
        next[idx] = { ...next[idx], ...memory };
        return next;
      });
      queryClient.setQueriesData<EpisodicMemory[]>({ queryKey: queryKeys.memories }, prev => {
        if (!prev) return [memory];
        if (memory.status === 'deleted') {
          return prev.filter(m => m.id !== memory.id);
        }
        const idx = prev.findIndex(m => m.id === memory.id);
        if (idx === -1) return [memory, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...memory };
        return next;
      });
    }

    function handlePerson(data: unknown) {
      if (!data || typeof data !== 'object') return;
      const person = data as Person;
      if (!person.id) return;

      queryClient.setQueryData<Person[]>(queryKeys.persons, prev => {
        if (!prev) return [person];
        const idx = prev.findIndex(p => p.id === person.id);
        if (idx === -1) return [...prev, person];
        const next = [...prev];
        next[idx] = { ...next[idx], ...person };
        return next;
      });
    }

    function handleAction(data: unknown) {
      if (!isNetworkAction(data)) return;
      const action = data;

      if (action.status !== 'proposed') {
        queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, prev =>
          (prev ?? []).filter(a => a.id !== action.id),
        );
        return;
      }

      queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, prev => {
        const list = prev ?? [];
        const idx = list.findIndex(a => a.id === action.id);
        if (idx === -1) return [action, ...list];
        return list.map((a, i) => (i === idx ? { ...a, ...action } : a));
      });
    }

    function handleActionQueue(data: unknown) {
      if (!isNetworkActionQueue(data)) return;
      queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, data);
    }

    const offWs = subscribeRealtimeMessages(msg => {
      switch (msg.event) {
        case 'interaction':
          handleInteraction(msg.data);
          break;
        case 'conversation':
          handleConversation(msg.data);
          break;
        case 'episodic_memory':
          handleMemory(msg.data);
          break;
        case 'person':
          handlePerson(msg.data);
          break;
        case 'action':
          handleAction(msg.data);
          break;
        case 'action_queue':
          handleActionQueue(msg.data);
          break;
        case 'realtime_status':
          if (typeof msg.connected === 'boolean') {
            runtimeActions.setNetworkConnected(msg.connected);
          }
          break;
        case 'session_ready': {
          const serverClientId = typeof msg.client_id === 'string' ? msg.client_id : null;
          if (serverClientId) {
            setClientName(serverClientId);
          }
          runtimeActions.setNetworkConnected(true);
          break;
        }
        case 'assistant_state':
          handleAssistantStateChanged(msg);
          break;
        default:
          break;
      }
    });

    let offNewInteraction: (() => void) | undefined;
    if (window.electronAPI?.onNewInteraction) {
      offNewInteraction = window.electronAPI.onNewInteraction((payload: unknown) => {
        const data = (payload as { data?: unknown }).data;
        if (data && typeof data === 'object') {
          trackExtraBootstrapConversation(data as Interaction);
        }
      });
    }

    return () => {
      offWs();
      if (offNewInteraction) offNewInteraction();
    };
  }, [handleAssistantStateSnapshot, queryClient, runtimeActions, trackExtraBootstrapConversation]);

  useEffect(() => {
    if (!window.electronAPI?.onWebhookAction) return;
    return window.electronAPI.onWebhookAction(payload => {
      if (payload.event === 'action_queue' && isNetworkActionQueue(payload.data)) {
        queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, payload.data);
        return;
      }
      if (payload.event === 'action' && payload.data) {
        const action = payload.data;
        if (!isNetworkAction(action)) return;
        if (action.status !== 'proposed') {
          queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, prev =>
            (prev ?? []).filter(a => a.id !== action.id),
          );
          return;
        }
        queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, prev => {
          const list = prev ?? [];
          const idx = list.findIndex(a => a.id === action.id);
          if (idx === -1) return [action, ...list];
          return list.map((a, i) => (i === idx ? { ...a, ...action } : a));
        });
      }
    });
  }, [queryClient]);

  const toggleService = useCallback(async () => {
    if (selectIsMicSyncPending(runtimeRef.current)) return;

    await runAssistantTransition(async () => {
      if (registrationConflict) {
        showToast(
          'Could not connect this device to the assistant. Refresh the page or restart the app.',
          'error',
        );
        return;
      }

      const ambientEnabled = selectIsAmbientEnabled(runtimeRef.current);
      const baseline = runtimeRef.current.serviceStateRevision;

      try {
        if (ambientEnabled) {
          await runtimeActions.runServiceStateMutation({
            baselineRevision: baseline,
            micPending: true,
            mutation: () => serviceApi.disable(),
          });
          return;
        }

        if (tutorialIncomplete) {
          return;
        }
        const granted = await checkRequiredPermissions();
        if (!granted) {
          pendingEnableRef.current = true;
          openPermissionsGate('enable');
          return;
        }
        const tutorialPlatform = toTutorialPlatform(platform, isElectron);
        const missingOptional = await hasMissingClientPermissions(tutorialPlatform, isElectron);
        if (missingOptional) {
          pendingEnableRef.current = true;
          openPermissionsGate('enable');
          return;
        }
        await runtimeActions.runServiceStateMutation({
          baselineRevision: baseline,
          micPending: true,
          mutation: () => serviceApi.enable(),
        });
      } catch (error) {
        console.error('Failed to toggle service:', error);
        showToast(getUserErrorMessage(error, 'Could not change assistant service state.'), 'error');
      }
    });
  }, [
    checkRequiredPermissions,
    isElectron,
    openPermissionsGate,
    platform,
    registrationConflict,
    runtimeActions,
    showToast,
    tutorialIncomplete,
  ]);

  const rejectAction = useCallback(
    async (actionId: string) => {
      await actionsApi.reject(actionId);
      queryClient.setQueryData<NetworkAction[]>(queryKeys.actions, prev =>
        (prev ?? []).filter(item => item.id !== actionId),
      );
    },
    [queryClient],
  );

  const pruneExtraBootstrapConversationId = useCallback((conversationId: string) => {
    const cid = conversationId.trim();
    if (!cid) return;
    setExtraBootstrapConversationIds(prev => prev.filter(x => x.trim() !== cid));
  }, []);

  const clearExtraBootstrapConversationIds = useCallback(() => {
    setExtraBootstrapConversationIds([]);
  }, []);

  const refetchPersons = useCallback(() => {
    void personsQuery.refetch();
  }, [personsQuery]);

  const retryInteractions = useCallback(() => {
    void recentConversationsQuery.refetch();
    void bootstrapInteractionsQuery.refetch();
    void personsQuery.refetch();
  }, [bootstrapInteractionsQuery, personsQuery, recentConversationsQuery]);

  const realtimeSessionId = getRealtimeSessionId();
  const isCommandOwner = selectIsCommandOwner(runtime, realtimeSessionId);
  const commandServiceRemainingMs = (() => {
    if (!commandServiceExpiresAt) return 0;
    const expiresAtMs = Date.parse(commandServiceExpiresAt);
    if (!Number.isFinite(expiresAtMs)) return 0;
    return Math.max(0, expiresAtMs - Date.now());
  })();

  const interactionsLoading =
    recentConversationsQuery.isLoading ||
    (bootstrapReady && allBootstrapIds.length > 0 && bootstrapInteractionsQuery.isLoading);

  const isReady =
    !isAuthenticated ||
    registrationConflict ||
    (isConnected &&
      sessionReady &&
      !interactionsLoading &&
      !personsQuery.isLoading);

  return (
    <ServiceContext.Provider
      value={{
        isReady,
        isServiceEnabled,
        isConnected,
        registrationConflict,
        clientName,
        toggleService,
        serviceStateSyncPending,
        isCommandService,
        isCommandOwner,
        commandOwnerSessionId,
        commandServiceExpiresAt,
        commandServiceRemainingMs,

        permissionsGateOpen,
        permissionsGateIntent,
        completePermissionsGate,
        dismissPermissionsGate,

        memories: memoriesQuery.data ?? [],
        memoriesLoading: memoriesQuery.isLoading,
        deleteMemory: async id => {
          await deleteMemoryMutation.mutateAsync(id);
        },
        isDeletingMemory: deleteMemoryMutation.isPending,

        actions,
        actionsLoading: false,
        rejectAction,

        persons: personsQuery.data ?? [],
        personsLoading: personsQuery.isLoading,
        refetchPersons,
        renamePerson: (personId, name) => renamePersonMutation.mutateAsync({ personId, name }),
        isRenamingPerson: renamePersonMutation.isPending,
        deletePerson: async personId => {
          await deletePersonMutation.mutateAsync(personId);
        },
        isDeletingPerson: deletePersonMutation.isPending,
        recentConversations: recentConversationsQuery.data ?? [],
        bootstrapInteractions: bootstrapInteractionsQuery.data ?? [],
        interactionsLoading,
        interactionsError:
          recentConversationsQuery.error ?? bootstrapInteractionsQuery.error ?? null,
        retryInteractions,
        conversationIdsKey,
        pruneExtraBootstrapConversationId,
        clearExtraBootstrapConversationIds,
      }}
    >
      {children}
    </ServiceContext.Provider>
  );
}

export function useService() {
  const context = useContext(ServiceContext);
  if (context === undefined) {
    throw new Error('useService must be used within a ServiceProvider');
  }
  return context;
}
