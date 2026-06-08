import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useReducedMotion } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { Conversation, Interaction } from '@dadei/ui/types/models.types';
import { interactionsApi } from '@dadei/ui/lib/api/interactions';
import { conversationsApi } from '@dadei/ui/lib/api/conversations';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import {
  conversationQueryOptions,
  INTERACTION_PANEL_RECENT_LIMIT,
  removeAllConversationQueries,
} from '@dadei/ui/lib/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { useTutorialContext } from '@dadei/ui/components/tutorial/TutorialContext';
import {
  TUTORIAL_COLLAPSE_CONVERSATION_STEP_IDS,
  TUTORIAL_FORCE_EXPAND_CONVERSATION_STEP_IDS,
} from '@dadei/ui/components/tutorial/constants';
import {
  isTutorialTestId,
  TUTORIAL_TEST_CONVERSATION_ID,
} from '@dadei/ui/components/tutorial/testData';
import { ORPHAN_KEY } from './constants';

const PERSON_COLOR_SHADES = [
  'bg-emerald-950/60 text-emerald-300 ring-emerald-500/25',
  'bg-sky-950/60 text-sky-300 ring-sky-500/25',
  'bg-violet-950/60 text-violet-300 ring-violet-500/25',
  'bg-amber-950/60 text-amber-300 ring-amber-500/25',
  'bg-rose-950/60 text-rose-300 ring-rose-500/25',
  'bg-cyan-950/60 text-cyan-300 ring-cyan-500/25',
] as const;
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
  const {
    isConnected,
    recentConversations,
    bootstrapInteractions,
    interactionsLoading,
    interactionsError,
    retryInteractions,
    persons,
    personsLoading,
    refetchPersons,
    pruneExtraBootstrapConversationId,
    clearExtraBootstrapConversationIds,
  } = useService();
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useNotifications();
  const prefersReducedMotion = useReducedMotion();
  const queryClient = useQueryClient();

  const recentIds = useMemo(
    () => recentConversations.map(c => c.id),
    [recentConversations],
  );

  const tutorial = useTutorialContext();
  const baseInteractions =
    bootstrapInteractions.length > 0 ? bootstrapInteractions : EMPTY_INTERACTIONS;

  const interactions = useMemo(() => {
    if (!tutorial?.isActive || !tutorial.tutorialInteractions.length) return baseInteractions;
    const seen = new Set(baseInteractions.map(i => i.id));
    const injected = tutorial.tutorialInteractions.filter(i => !seen.has(i.id));
    return [...injected, ...baseInteractions];
  }, [baseInteractions, tutorial?.tutorialInteractions]);

  const conversationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of recentIds) ids.add(id);
    for (const interaction of interactions) {
      const id = interaction.conversation_id?.trim();
      if (id) ids.add(id);
    }
    return Array.from(ids).sort();
  }, [interactions, recentIds]);

  /** Tutorial fixtures use non-UUID ids; never fetch them from the API. */
  const apiConversationIds = useMemo(
    () => conversationIds.filter(id => !isTutorialTestId(id)),
    [conversationIds],
  );

  const conversationQueries = useQueries({
    queries: apiConversationIds.map(id => ({
      ...conversationQueryOptions(id),
      enabled: isConnected && Boolean(id),
    })),
  });

  const conversationIdsKey = conversationIds.join('\u001f');
  const apiConversationIdsKey = apiConversationIds.join('\u001f');
  const conversationDataKey = apiConversationIds
    .map((id, i) => {
      const d = conversationQueries[i]?.data;
      if (!d) return `${id}:`;
      return `${id}:${d.started_at ?? ''}:${d.is_active ? '1' : '0'}:${d.topic_summary ?? ''}:${d.context_summary ?? ''}`;
    })
    .join('\u001f');

  const conversationById = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const conv of tutorial?.isActive ? tutorial.tutorialConversations : []) {
      map.set(conv.id, conv);
    }
    apiConversationIds.forEach((id, index) => {
      const data = conversationQueries[index]?.data;
      if (data) map.set(id, data);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable keys derived from query *data*, not the queries array identity
  }, [conversationDataKey, apiConversationIdsKey, tutorial?.tutorialConversations]);

  const [conversationGroups, setConversationGroups] = useState<ConversationGroupState[]>([]);
  const loading = interactionsLoading;

  const personsById = useMemo(() => {
    const map = new Map(persons.map(person => [person.id, person]));
    for (const person of tutorial?.isActive ? tutorial.tutorialPersons : []) {
      if (!map.has(person.id)) map.set(person.id, person);
    }
    return map;
  }, [persons, tutorial?.tutorialPersons]);

  useEffect(() => {
    if (!isConnected || personsLoading) return;
    const known = new Set(persons.map(p => p.id));
    const hasUnknownPerson = interactions.some(i => {
      const pid = i.person_id?.trim();
      return Boolean(pid) && !isTutorialTestId(pid) && !known.has(pid);
    });
    if (hasUnknownPerson) {
      refetchPersons();
    }
  }, [isConnected, interactions, persons, personsLoading, refetchPersons]);

  const displayGroups: ConversationGroupView[] = useMemo(() => {
    const activeKey = activeConversationKey(conversationGroups);
    return conversationGroups.map(g => {
      const gkey = groupKey(g);
      const isActive = activeKey !== null && gkey === activeKey;
      const isExpanded = g.isExpanded !== undefined ? g.isExpanded : isActive;
      return { ...g, isActive, isExpanded };
    });
  }, [conversationGroups]);

  const interactionsScrollSignature = useMemo(
    () =>
      conversationGroups
        .flatMap(g => g.interactions)
        .map(i => i.id)
        .join('\u001f'),
    [conversationGroups],
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

  const panelLoadError = useMemo(() => {
    if (!isConnected) return null;
    if (interactionsError) {
      return getUserErrorMessage(
        interactionsError,
        'Could not load conversations.',
      );
    }
    return null;
  }, [isConnected, interactionsError]);

  const retryPanelLoad = useCallback(() => {
    retryInteractions();
  }, [retryInteractions]);

  useEffect(() => {
    setConversationGroups(previous => {
      const groups = buildConversationGroups(interactions, conversationById, previous);
      if (!tutorial) return groups;

      if (TUTORIAL_COLLAPSE_CONVERSATION_STEP_IDS.has(tutorial.step.id)) {
        return groups.map(g => {
          if (groupKey(g) !== TUTORIAL_TEST_CONVERSATION_ID) return g;
          return { ...g, isExpanded: false };
        });
      }

      if (TUTORIAL_FORCE_EXPAND_CONVERSATION_STEP_IDS.has(tutorial.step.id)) {
        return groups.map(g => {
          if (groupKey(g) !== TUTORIAL_TEST_CONVERSATION_ID) return g;
          return { ...g, isExpanded: true };
        });
      }

      return groups;
    });
  }, [interactions, conversationById, tutorial?.step.id]);

  useEffect(() => {
    if (tutorial?.step.id !== 'expand_conversation') return;
    const expanded = displayGroups.some(
      g => groupKey(g) === TUTORIAL_TEST_CONVERSATION_ID && g.isExpanded,
    );
    if (expanded) {
      tutorial.markActionFired('expand-conversation');
    }
  }, [tutorial, displayGroups]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [interactionsScrollSignature]);

  const toggleConversation = (index: number) => {
    setConversationGroups(prev => {
      const activeKey = activeConversationKey(prev);
      const target = prev[index];
      if (!target) return prev;
      const derived =
        target.isExpanded !== undefined
          ? target.isExpanded
          : activeKey !== null && groupKey(target) === activeKey;
      const willExpand = !derived;

      const next = prev.map((g, i) => {
        if (i !== index) return g;
        return { ...g, isExpanded: !derived };
      });

      if (
        willExpand &&
        tutorial?.step.id === 'expand_conversation' &&
        groupKey(target) === TUTORIAL_TEST_CONVERSATION_ID
      ) {
        queueMicrotask(() => tutorial.markActionFired('expand-conversation'));
      }

      return next;
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

  useEffect(() => {
    if (!isConnected) return;
    for (let i = 0; i < conversationQueries.length; i++) {
      const q = conversationQueries[i];
      const id = apiConversationIds[i];
      if (!id?.trim() || !q?.isError) continue;
      const err = q.error;
      if (!isAxiosError(err) || err.response?.status !== 404) continue;
      const cid = id.trim();
      pruneExtraBootstrapConversationId(cid);
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
  }, [
    isConnected,
    conversationQueries,
    apiConversationIds,
    queryClient,
    pruneExtraBootstrapConversationId,
  ]);

  const handleDeleteInteraction = async (interactionId: string) => {
    if (isTutorialTestId(interactionId)) {
      tutorial?.removeTutorialInteraction(interactionId);
      showToast('Interaction deleted', 'success');
      setArmedInteractionDeleteId(null);
      return;
    }
    try {
      await interactionsApi.delete(interactionId);
      patchInteractionCaches(previous => (previous ?? []).filter(i => i.id !== interactionId));

      showToast('Interaction deleted', 'success');
      setArmedInteractionDeleteId(null);
    } catch (error) {
      console.error('Failed to delete interaction:', error);
      showToast(getUserErrorMessage(error, 'Could not delete that interaction.'), 'error');
      setArmedInteractionDeleteId(null);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (isTutorialTestId(conversationId)) {
      tutorial?.removeTutorialConversation();
      showToast('Conversation deleted', 'success');
      setArmedConversationDeleteId(null);
      return;
    }
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
      pruneExtraBootstrapConversationId(cid);
      patchInteractionCaches(previous =>
        (previous ?? []).filter(i => (i.conversation_id?.trim() ?? '') !== cid)
      );
      queryClient.removeQueries({ queryKey: queryKeys.conversationById(conversationId) });
      queryClient.setQueryData<Conversation[]>(
        queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
        prev => (prev ?? []).filter(c => c.id !== conversationId)
      );
      retryInteractions();

      showToast('Conversation deleted', 'success');
      setArmedConversationDeleteId(null);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      showToast(getUserErrorMessage(error, 'Could not delete that conversation.'), 'error');
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
      clearExtraBootstrapConversationIds();
      patchInteractionCaches(() => []);
      removeAllConversationQueries(queryClient);
      queryClient.setQueryData<Conversation[]>(
        queryKeys.conversationsRecent(INTERACTION_PANEL_RECENT_LIMIT),
        [],
      );
      retryInteractions();
      showToast('All interactions cleared', 'success');
    } catch (error) {
      console.error('Failed to clear:', error);
      showToast(getUserErrorMessage(error, 'Could not clear interactions.'), 'error');
    }
  };

  const personsSortedByCreated = useMemo(
    () =>
      Array.from(personsById.values()).sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      ),
    [personsById]
  );

  const positionByPersonId = useMemo(() => {
    const m = new Map<string, number>();
    personsSortedByCreated.forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [personsSortedByCreated]);

  const getPersonDisplay = (
    personId: string
  ): { label: string; position: number; isUser: boolean } => {
    const person = personsById.get(personId);
    const position = positionByPersonId.get(personId) ?? 0;
    const isUser = person?.is_user ?? false;
    if (person?.name) return { label: person.name, position, isUser };
    if (person) return { label: isUser ? 'You' : `Person ${position}`, position, isUser };
    return { label: 'Loading...', position: 0, isUser: false };
  };

  const getPersonColor = (personId: string) => {
    let hash = 0;
    for (let i = 0; i < personId.length; i++) {
      hash = (hash * 31 + personId.charCodeAt(i)) | 0;
    }
    return PERSON_COLOR_SHADES[Math.abs(hash) % PERSON_COLOR_SHADES.length];
  };

  return {
    containerRef,
    loading,
    panelLoadError,
    retryPanelLoad,
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
    getPersonColor,
  };
}
