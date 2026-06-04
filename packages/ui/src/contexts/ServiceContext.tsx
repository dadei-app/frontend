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
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { parseInteractionDate } from '@dadei/ui/components/interaction-panel/conversationUtils';
import { getUserErrorMessage, ERROR_CODES } from '@dadei/ui/lib/errors/userMessage';
import { actionsApi } from '@dadei/ui/lib/api/actions';
import { memoriesApi } from '@dadei/ui/lib/api/memories';
import { personsApi } from '@dadei/ui/lib/api/persons';
import { conversationsApi } from '@dadei/ui/lib/api/conversations';
import { interactionsApi } from '@dadei/ui/lib/api/interactions';
import { serviceApi } from '@dadei/ui/lib/api/service';
import {
  startRealtimeClient,
  stopRealtimeClient,
  subscribeRealtimeMessages,
} from '@dadei/ui/lib/realtime/realtimeClient';
import { getRealtimeSessionId } from '@dadei/ui/lib/realtime/realtimeClient';
import { clearAssistantSessionCaches } from '@dadei/ui/lib/query/cacheUtils';
import {
  ASSISTANT_MEMORIES_LIST_LIMIT,
  conversationQueryOptions,
  INTERACTION_PANEL_RECENT_LIMIT,
} from '@dadei/ui/lib/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
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
  isServiceEnabled: boolean;
  isConnected: boolean;
  registrationConflict: boolean;
  clientName: string;
  toggleService: () => Promise<void>;
  isTogglingService: boolean;
  isAssistantMode: boolean;
  isAssistantOwner: boolean;
  assistantOwnerSessionId: string | null;
  assistantModeExpiresAt: string | null;
  assistantModeRemainingMs: number;

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
  retrainUserVoice: (wavBuffer: ArrayBuffer) => Promise<Person>;
  isRetrainingUserVoice: boolean;

  recentConversations: Conversation[];
  bootstrapInteractions: Interaction[];
  interactionsLoading: boolean;
  interactionsError: unknown;
  retryInteractions: () => void;
  conversationIdsKey: string;
  pruneExtraBootstrapConversationId: (conversationId: string) => void;
  clearExtraBootstrapConversationIds: () => void;
}

export const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, getAccessToken } = useAuth();
  const { showToast } = useNotifications();
  const queryClient = useQueryClient();
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const [isServiceEnabled, setIsServiceEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [clientName, setClientName] = useState('');
  const [isTogglingService, setIsTogglingService] = useState(false);
  const [registrationConflict, setRegistrationConflict] = useState(false);
  const [isAssistantMode, setIsAssistantMode] = useState(false);
  const [assistantOwnerSessionId, setAssistantOwnerSessionId] = useState<string | null>(null);
  const [assistantModeExpiresAt, setAssistantModeExpiresAt] = useState<string | null>(null);

  const [extraBootstrapConversationIds, setExtraBootstrapConversationIds] = useState<string[]>([]);
  const [actions, setActions] = useState<NetworkAction[]>([]);

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
    },
  });

  const retrainUserVoiceMutation = useMutation({
    mutationFn: (wavBuffer: ArrayBuffer) => personsApi.retrainUserVoice(wavBuffer),
    onSuccess: updated => {
      queryClient.setQueryData<Person[]>(queryKeys.persons, prev =>
        (prev ?? []).map(p => (p.id === updated.id ? updated : p)),
      );
      queryClient.setQueryData(queryKeys.personById(updated.id), updated);
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

  const applyServiceStatus = useCallback((enabled: boolean) => {
    setIsServiceEnabled(enabled);
    setIsTogglingService(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      stopRealtimeClient();
      setIsConnected(false);
      setRegistrationConflict(false);
      setIsAssistantMode(false);
      setAssistantOwnerSessionId(null);
      setAssistantModeExpiresAt(null);
      setExtraBootstrapConversationIds([]);
      clearAssistantSessionCaches(queryClient);
    }
  }, [isAuthenticated, queryClient]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      setIsConnected(false);
      return;
    }

    let cancelled = false;

    const connectRealtime = async () => {
      try {
        if (cancelled) return;
        setRegistrationConflict(false);
        startRealtimeClient({
          getAccessToken: () => getAccessTokenRef.current(),
        });
      } catch (error: unknown) {
        console.error('Failed to start realtime client:', error);
        setRegistrationConflict(true);
        setIsConnected(false);
        stopRealtimeClient();
        showToast(getUserErrorMessage(error, ERROR_CODES.invalid_session), 'error');
      }
    };

    void connectRealtime();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthLoading, showToast]);

  useEffect(() => {
    const handleServiceStatusChanged = (status: { enabled: boolean }) => {
      console.log('[Service] Status event:', status.enabled ? 'ENABLED' : 'DISABLED');
      applyServiceStatus(status.enabled);
    };
    const handleAssistantModeChanged = (payload: {
      active: boolean;
      ownerSessionId: string | null;
      expiresAt: string | null;
    }) => {
      setIsAssistantMode(payload.active);
      setAssistantOwnerSessionId(payload.ownerSessionId);
      setAssistantModeExpiresAt(payload.expiresAt);
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
            setIsConnected(msg.connected);
          }
          break;
        case 'session_ready': {
          const serverClientId = typeof msg.client_id === 'string' ? msg.client_id : null;
          if (serverClientId) {
            setClientName(serverClientId);
          }
          setIsConnected(true);
          setRegistrationConflict(false);
          break;
        }
        case 'service_status':
          if (typeof msg.enabled !== 'boolean') return;
          handleServiceStatusChanged({ enabled: msg.enabled });
          break;
        case 'assistant_mode': {
          const active = typeof msg.active === 'boolean' ? msg.active : false;
          const ownerSessionId =
            typeof msg.owner_session_id === 'string' ? msg.owner_session_id : null;
          const expiresAt = typeof msg.expires_at === 'string' ? msg.expires_at : null;
          handleAssistantModeChanged({ active, ownerSessionId, expiresAt });
          break;
        }
        default:
          break;
      }
    });

    let offElectron: (() => void) | undefined;
    if (window.electronAPI?.onServiceStatusChanged) {
      offElectron = window.electronAPI.onServiceStatusChanged(handleServiceStatusChanged);
    }

    let offNewInteraction: (() => void) | undefined;
    if (window.electronAPI?.onNewInteraction) {
      offNewInteraction = window.electronAPI.onNewInteraction((payload: { data?: unknown }) => {
        const interaction = payload.data;
        if (interaction && typeof interaction === 'object') {
          trackExtraBootstrapConversation(interaction as Interaction);
        }
      });
    }

    return () => {
      offWs();
      if (offElectron) offElectron();
      if (offNewInteraction) offNewInteraction();
    };
  }, [applyServiceStatus, queryClient, trackExtraBootstrapConversation]);

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
    if (registrationConflict) {
      showToast(
        'Could not connect this device to the assistant. Refresh the page or restart the app.',
        'error',
      );
      return;
    }

    setIsTogglingService(true);

    try {
      if (isServiceEnabled) {
        await serviceApi.disable();
        setIsTogglingService(false);
      } else {
        await serviceApi.enable();
        applyServiceStatus(true);
      }
    } catch (error) {
      console.error('Failed to toggle service:', error);
      setIsTogglingService(false);
      showToast(getUserErrorMessage(error, 'Could not change assistant service state.'), 'error');
    }
  }, [applyServiceStatus, isServiceEnabled, registrationConflict, showToast]);

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
  const isAssistantOwner =
    isAssistantMode && !!realtimeSessionId && assistantOwnerSessionId === realtimeSessionId;
  const assistantModeRemainingMs = (() => {
    if (!assistantModeExpiresAt) return 0;
    const expiresAtMs = Date.parse(assistantModeExpiresAt);
    if (!Number.isFinite(expiresAtMs)) return 0;
    return Math.max(0, expiresAtMs - Date.now());
  })();

  const interactionsLoading =
    recentConversationsQuery.isLoading ||
    (bootstrapReady && allBootstrapIds.length > 0 && bootstrapInteractionsQuery.isLoading);

  return (
    <ServiceContext.Provider
      value={{
        isServiceEnabled,
        isConnected,
        registrationConflict,
        clientName,
        toggleService,
        isTogglingService,
        isAssistantMode,
        isAssistantOwner,
        assistantOwnerSessionId,
        assistantModeExpiresAt,
        assistantModeRemainingMs,

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
        retrainUserVoice: wavBuffer => retrainUserVoiceMutation.mutateAsync(wavBuffer),
        isRetrainingUserVoice: retrainUserVoiceMutation.isPending,

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
