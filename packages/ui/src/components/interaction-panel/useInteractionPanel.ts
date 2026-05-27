import { useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useReducedMotion } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { Conversation, Interaction, Person } from '@dadei/ui/types/models.types';
import { interactionsApi } from '@dadei/ui/lib/api/interactions';
import { conversationsApi } from '@dadei/ui/lib/api/conversations';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { subscribeRealtimeMessages } from '@dadei/ui/lib/realtimeClient';
import {
  conversationQueryOptions,
  INTERACTION_PANEL_RECENT_LIMIT,
  removeAllConversationQueries,
  useInteractionsBootstrapQuery,
  usePersonsQuery,
  useRecentConversationsQuery,
} from '@dadei/ui/lib/queryHooks';
import { queryKeys } from '@dadei/ui/lib/queryKeys';
import { ORPHAN_KEY } from './constants';
import { activeConversationKey, groupKey, parseInteractionDate } from './conversationUtils';
import type { ConversationGroupState, ConversationGroupView } from './types';

/** Stable fallback so `useEffect` / `useMemo` deps do not churn when the query has no `data` yet. */
const EMPTY_INTERACTIONS: Interaction[] = [];

function buildConversationGroups(
  interactions: Interaction[],
  conversationById: Map<string, Conversation>,
  previous: ConversationGroupState[] = []
): ConversationGroupState[] {
  const expandedByKey = new Map<string, boolean | undefined>();
  for (const group of previous) {
    expandedByKey.set(groupKey(group), group.isExpanded);
  }

  const grouped = new Map<string | null, Interaction[]>();
  for (const interaction of interactions) {
    const convId = interaction.conversation_id?.trim() || null;
    const existing = grouped.get(convId) ?? [];
    existing.push(interaction);
    grouped.set(convId, existing);
  }

  const groups: ConversationGroupState[] = [];
  for (const [conversationId, interactionGroup] of grouped.entries()) {
    const sortedInteractions = [...interactionGroup].sort(
      (a, b) =>
        parseInteractionDate(a.timestamp).getTime() -
        parseInteractionDate(b.timestamp).getTime()
    );
    const key = conversationId ?? ORPHAN_KEY;
    groups.push({
      conversation: conversationId ? conversationById.get(conversationId) ?? null : null,
      interactions: sortedInteractions,
      isExpanded: expandedByKey.get(key),
    });
  }

  groups.sort((a, b) => {
    const aTime = a.conversation?.started_at || a.interactions[0]?.timestamp || '';
    const bTime = b.conversation?.started_at || b.interactions[0]?.timestamp || '';
    return parseInteractionDate(bTime).getTime() - parseInteractionDate(aTime).getTime();
  });

  return groups;
}

export function useInteractionPanel() {
  const { isConnected } = useService();
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useNotifications();
  const prefersReducedMotion = useReducedMotion();
  const queryClient = useQueryClient();

  const recentConversationsQuery = useRecentConversationsQuery(
    isConnected,
    INTERACTION_PANEL_RECENT_LIMIT
  );

  const recentIds = useMemo(
    () => (recentConversationsQuery.data ?? []).map(c => c.id),
    [recentConversationsQuery.data]
  );

  /**
   * Conversation IDs returned by GET /conversations/recent are capped; realtime interactions
   * can reference an older active conversation. Track those extras so bootstrap refetches include them.
   */
  const [extraBootstrapConversationIds, setExtraBootstrapConversationIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isConnected) {
      setExtraBootstrapConversationIds([]);
    }
  }, [isConnected]);

  const idsForBootstrapFetch = useMemo(() => {
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

  const interactionsBootstrapKey = useMemo(
    () => idsForBootstrapFetch.join('\u001f'),
    [idsForBootstrapFetch]
  );

  const interactionsBootstrapQuery = useInteractionsBootstrapQuery(
    idsForBootstrapFetch,
    isConnected && (recentConversationsQuery.isSuccess || recentConversationsQuery.isError)
  );

  const personsQuery = usePersonsQuery(isConnected);
  const interactions = interactionsBootstrapQuery.data ?? EMPTY_INTERACTIONS;

  const conversationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of recentIds) ids.add(id);
    for (const interaction of interactions) {
      const id = interaction.conversation_id?.trim();
      if (id) ids.add(id);
    }
    return Array.from(ids).sort();
  }, [interactions, recentIds]);

  const conversationQueries = useQueries({
    queries: conversationIds.map(id => ({
      ...conversationQueryOptions(id),
      enabled: isConnected && Boolean(id),
    })),
  });

  /** `useQueries` returns a new array each render; do not put it in useMemo deps or `conversationById` churns forever. */
  const conversationIdsKey = conversationIds.join('\u001f');
  const conversationDataKey = conversationIds
    .map((id, i) => {
      const d = conversationQueries[i]?.data;
      if (!d) return `${id}:`;
      return `${id}:${d.started_at ?? ''}:${d.is_active ? '1' : '0'}:${d.topic_summary ?? ''}:${d.context_summary ?? ''}`;
    })
    .join('\u001f');

  const conversationById = useMemo(() => {
    const map = new Map<string, Conversation>();
    conversationIds.forEach((id, index) => {
      const data = conversationQueries[index]?.data;
      if (data) map.set(id, data);
    });
    return map;
    // conversationQueries omitted on purpose — see conversationDataKey above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable keys derived from query *data*, not the queries array identity
  }, [conversationDataKey, conversationIdsKey]);

  const [conversationGroups, setConversationGroups] = useState<ConversationGroupState[]>([]);
  const loading =
    recentConversationsQuery.isLoading ||
    (isConnected &&
      (recentConversationsQuery.isSuccess || recentConversationsQuery.isError) &&
      interactionsBootstrapQuery.isLoading);

  const personsById = useMemo(
    () => new Map((personsQuery.data ?? []).map(person => [person.id, person])),
    [personsQuery.data]
  );

  /**
   * Interactions (bootstrap + realtime) can reference a person created after the last
   * GET /persons. Without a refetch, getPersonDisplay falls through to "Loading..." forever.
   */
  useEffect(() => {
    if (!isConnected || !personsQuery.isSuccess) return;
    const known = new Set((personsQuery.data ?? []).map(p => p.id));
    const hasUnknownPerson = interactions.some(
      i => Boolean(i.person_id?.trim()) && !known.has(i.person_id.trim())
    );
    if (hasUnknownPerson && !personsQuery.isFetching) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
    }
  }, [
    isConnected,
    interactions,
    personsQuery.data,
    personsQuery.isFetching,
    personsQuery.isSuccess,
    queryClient,
  ]);

  const displayGroups: ConversationGroupView[] = useMemo(() => {
    const activeKey = activeConversationKey(conversationGroups);
    return conversationGroups.map(g => {
      const gkey = groupKey(g);
      const isActive = activeKey !== null && gkey === activeKey;
      const isExpanded = g.isExpanded !== undefined ? g.isExpanded : isActive;
      return { ...g, isActive, isExpanded };
    });
  }, [conversationGroups]);

  /** Only changes when interactions are added/removed/reordered — not on expand/collapse. */
  const interactionsScrollSignature = useMemo(
    () =>
      conversationGroups
        .flatMap(g => g.interactions)
        .map(i => i.id)
        .join('\u001f'),
    [conversationGroups]
  );

  const [armedInteractionDeleteId, setArmedInteractionDeleteId] = useState<string | null>(null);
  const [armedConversationDeleteId, setArmedConversationDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!armedInteractionDeleteId && !armedConversationDeleteId) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-split-delete]')) return;
      setArmedInteractionDeleteId(null);
      setArmedConversationDeleteId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmedInteractionDeleteId(null);
        setArmedConversationDeleteId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [armedInteractionDeleteId, armedConversationDeleteId]);

  useEffect(() => {
    if (!isConnected) return;
    if (recentConversationsQuery.isError) {
      showToast('Failed to load conversations', 'error');
    }
  }, [recentConversationsQuery.isError, isConnected, showToast]);

  useEffect(() => {
    if (!isConnected) return;
    if (interactionsBootstrapQuery.isError) {
      showToast('Failed to load interactions', 'error');
    }
  }, [interactionsBootstrapQuery.isError, isConnected, showToast]);

  useEffect(() => {
    setConversationGroups(previous => buildConversationGroups(interactions, conversationById, previous));
  }, [interactions, conversationById]);

  useEffect(() => {
    if (!isConnected) return;

    const mergeIntoCaches = (interaction: Interaction) => {
      queryClient.setQueriesData<Interaction[]>(
        { queryKey: [...queryKeys.interactions, 'bootstrap'] },
        prev => {
          if (!prev) return [interaction];
          if (prev.some(item => item.id === interaction.id)) return prev;
          return [...prev, interaction];
        }
      );
      queryClient.setQueryData<Interaction[]>(queryKeys.interactions, prev => {
        if (!prev) return [interaction];
        if (prev.some(item => item.id === interaction.id)) return prev;
        return [...prev, interaction];
      });
      const convId = interaction.conversation_id?.trim();
      if (convId) {
        void queryClient.prefetchQuery(conversationQueryOptions(convId));
        setExtraBootstrapConversationIds(prev => {
          if (prev.some(x => x.trim() === convId)) return prev;
          if (recentIds.some(x => x.trim() === convId)) return prev;
          return [...prev, convId];
        });
      }
    };

    const handleNewInteraction = (payload: { data?: Interaction }) => {
      const interaction = payload.data;
      if (!interaction) return;
      mergeIntoCaches(interaction);
    };

    const handleConversationUpdate = (payload: { data?: Conversation }) => {
      const conv = payload.data;
      if (!conv?.id) return;
      queryClient.setQueryData<Conversation>(queryKeys.conversationById(conv.id), conv);
      queryClient.setQueryData<Conversation[]>(
        queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
        prev => {
          if (!prev?.length) return prev;
          const idx = prev.findIndex(c => c.id === conv.id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], ...conv };
          return next;
        }
      );
    };

    const offWs = subscribeRealtimeMessages(msg => {
      if (msg.event === 'interaction') {
        const data = msg.data;
        if (!data || typeof data !== 'object') return;
        handleNewInteraction({ data: data as Interaction });
        return;
      }
      if (msg.event === 'conversation') {
        const data = msg.data;
        if (!data || typeof data !== 'object') return;
        handleConversationUpdate({ data: data as Conversation });
      }
    });

    let offElectron: (() => void) | undefined;
    if (window.electronAPI?.onNewInteraction) {
      offElectron = window.electronAPI.onNewInteraction(handleNewInteraction);
    }

    return () => {
      offWs();
      if (offElectron) offElectron();
    };
  }, [isConnected, queryClient, interactionsBootstrapKey, recentIds]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [interactionsScrollSignature]);

  const toggleConversation = (index: number) => {
    setConversationGroups(prev => {
      const activeKey = activeConversationKey(prev);
      return prev.map((g, i) => {
        if (i !== index) return g;
        const derived =
          g.isExpanded !== undefined
            ? g.isExpanded
            : activeKey !== null && groupKey(g) === activeKey;
        return { ...g, isExpanded: !derived };
      });
    });
  };

  const patchInteractionCaches = (
    updater: (prev: Interaction[] | undefined) => Interaction[] | undefined
  ) => {
    queryClient.setQueriesData<Interaction[]>(
      { queryKey: [...queryKeys.interactions, 'bootstrap'] },
      updater
    );
    queryClient.setQueryData<Interaction[]>(queryKeys.interactions, updater);
  };

  /** Drop cached interactions tied to a conversation row the API no longer has (stale client state). */
  useEffect(() => {
    if (!isConnected) return;
    for (let i = 0; i < conversationQueries.length; i++) {
      const q = conversationQueries[i];
      const id = conversationIds[i];
      if (!id?.trim() || !q?.isError) continue;
      const err = q.error;
      if (!isAxiosError(err) || err.response?.status !== 404) continue;
      const cid = id.trim();
      setExtraBootstrapConversationIds(prev => prev.filter(x => x.trim() !== cid));
      queryClient.setQueriesData<Interaction[]>(
        { queryKey: [...queryKeys.interactions, 'bootstrap'] },
        prev => (prev ?? []).filter(i => (i.conversation_id?.trim() ?? '') !== cid)
      );
      queryClient.setQueryData<Interaction[]>(queryKeys.interactions, prev =>
        (prev ?? []).filter(i => (i.conversation_id?.trim() ?? '') !== cid)
      );
      queryClient.setQueryData<Conversation[]>(
        queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
        prev => (prev ?? []).filter(c => c.id !== cid)
      );
      queryClient.removeQueries({ queryKey: queryKeys.conversationById(cid) });
    }
  }, [isConnected, conversationQueries, conversationIds, queryClient]);

  const handleDeleteInteraction = async (interactionId: string) => {
    try {
      await interactionsApi.delete(interactionId);
      patchInteractionCaches(previous => (previous ?? []).filter(i => i.id !== interactionId));

      showToast('Interaction deleted', 'success');
      setArmedInteractionDeleteId(null);
    } catch (error) {
      console.error('Failed to delete interaction:', error);
      showToast('Failed to delete interaction', 'error');
      setArmedInteractionDeleteId(null);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const group = conversationGroups.find(
        g => g.conversation?.id === conversationId || groupKey(g) === conversationId
      );
      if (!group) {
        showToast('Conversation not found', 'error');
        setArmedConversationDeleteId(null);
        return;
      }

      await conversationsApi.delete(conversationId);
      const cid = conversationId.trim();
      setExtraBootstrapConversationIds(prev => prev.filter(x => x.trim() !== cid));
      patchInteractionCaches(previous =>
        (previous ?? []).filter(i => (i.conversation_id?.trim() ?? '') !== cid)
      );
      queryClient.removeQueries({ queryKey: queryKeys.conversationById(conversationId) });
      queryClient.setQueryData<Conversation[]>(
        queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
        prev => (prev ?? []).filter(c => c.id !== conversationId)
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.interactions });

      showToast('Conversation deleted', 'success');
      setArmedConversationDeleteId(null);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      showToast('Failed to delete conversation', 'error');
      setArmedConversationDeleteId(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await Promise.all(
        conversationGroups.map(async group => {
          const cid =
            group.conversation?.id?.trim() ||
            group.interactions.find(i => i.conversation_id?.trim())?.conversation_id?.trim();
          if (cid) {
            await conversationsApi.delete(cid);
          } else {
            await Promise.all(group.interactions.map(i => interactionsApi.delete(i.id)));
          }
        })
      );
      setExtraBootstrapConversationIds([]);
      patchInteractionCaches(() => []);
      removeAllConversationQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.interactions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.persons });
      showToast('All interactions cleared', 'success');
    } catch (error) {
      console.error('Failed to clear:', error);
      showToast('Failed to clear interactions', 'error');
    }
  };

  const getPersonDisplay = (personId: string): { label: string; index: number } => {
    const person = personsById.get(personId);
    if (person?.name) return { label: person.name, index: person.index };
    if (person?.index !== undefined) return { label: `Person ${person.index}`, index: person.index };
    return { label: 'Loading...', index: 1 };
  };

  return {
    containerRef,
    loading,
    conversationGroups,
    displayGroups,
    prefersReducedMotion,
    armedInteractionDeleteId,
    armedConversationDeleteId,
    setArmedInteractionDeleteId,
    setArmedConversationDeleteId,
    toggleConversation,
    handleDeleteInteraction,
    handleDeleteConversation,
    handleClearAll,
    getPersonDisplay,
  };
}
