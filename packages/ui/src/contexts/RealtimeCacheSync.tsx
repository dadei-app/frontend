import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeRealtimeMessages } from '@dadei/ui/lib/realtime/realtimeClient';
import { INTERACTION_PANEL_RECENT_LIMIT } from '@dadei/ui/lib/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { parseInteractionDate } from '@dadei/ui/components/interaction-panel/conversationUtils';
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
  return typeof o.id === 'string' && typeof o.action_type === 'string' && typeof o.status === 'string';
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

/**
 * Central React Query cache sync for realtime WebSocket (and desktop webhook) events.
 * Mounted once inside {@link AppQueryProvider}.
 */
export function RealtimeCacheSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
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

      queryClient.setQueriesData<EpisodicMemory[]>(
        { queryKey: queryKeys.memories },
        prev => {
          if (!prev) return [memory];
          if (memory.status === 'deleted') {
            return prev.filter(m => m.id !== memory.id);
          }
          const idx = prev.findIndex(m => m.id === memory.id);
          if (idx === -1) return [memory, ...prev];
          const next = [...prev];
          next[idx] = { ...next[idx], ...memory };
          return next;
        },
      );
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

    const unsubscribe = subscribeRealtimeMessages(msg => {
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
        default:
          break;
      }
    });

    let offWebhook: (() => void) | undefined;
    if (typeof window !== 'undefined' && window.electronAPI?.onWebhookAction) {
      offWebhook = window.electronAPI.onWebhookAction(payload => {
        if (payload.event === 'action_queue' && isNetworkActionQueue(payload.data)) {
          handleActionQueue(payload.data);
          return;
        }
        if (payload.event === 'action' && payload.data) {
          handleAction(payload.data);
        }
      });
    }

    return () => {
      unsubscribe();
      offWebhook?.();
    };
  }, [queryClient]);

  return null;
}
