import type { Conversation, Interaction } from '@dadei/ui/types/models.types';
import { ORPHAN_KEY } from './constants';
import type { ConversationGroupState, ConversationGroupView } from './types';

/**
 * Parse API datetimes for display and sorting. Strings without a timezone are treated as UTC
 * (common for SQLAlchemy/FastAPI naive UTC), then `toLocale*` shows the user's local time.
 */
export function parseInteractionDate(iso: string | undefined | null): Date {
  if (iso == null || String(iso).trim() === '') {
    return new Date(NaN);
  }
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?$/.test(s)) {
    return new Date(`${s}Z`);
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,9})?$/.test(s)) {
    return new Date(`${s.replace(' ', 'T')}Z`);
  }
  return new Date(s);
}

export function formatLocalTime(iso: string | undefined | null): string {
  const d = parseInteractionDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatLocalDate(iso: string | undefined | null): string {
  const d = parseInteractionDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** Stable bucket id: conversation row id, else first known interaction conversation_id, else orphan sentinel. */
export function groupKey(g: { conversation: Conversation | null; interactions: Interaction[] }): string {
  if (g.conversation?.id) return g.conversation.id;
  const cid = g.interactions.find(i => i.conversation_id?.trim())?.conversation_id?.trim();
  return cid || ORPHAN_KEY;
}

export function interactionKey(i: Interaction): string {
  return i.conversation_id?.trim() || ORPHAN_KEY;
}

export function latestInteraction(groups: { interactions: Interaction[] }[]): Interaction | null {
  const all = groups.flatMap(g => g.interactions);
  if (all.length === 0) return null;
  return all.reduce((a, b) =>
    parseInteractionDate(b.timestamp).getTime() > parseInteractionDate(a.timestamp).getTime()
      ? b
      : a
  );
}

function hasConversationSummary(conversation: Conversation | null): boolean {
  if (!conversation) return false;
  return Boolean(conversation.topic_summary?.trim() || conversation.context_summary?.trim());
}

export function activeConversationKey(
  groups: { conversation: Conversation | null; interactions: Interaction[] }[]
): string | null {
  const latest = latestInteraction(groups);
  if (!latest) return null;
  const key = interactionKey(latest);
  const latestGroup = groups.find(g => groupKey(g) === key);
  if (!latestGroup) return null;
  return hasConversationSummary(latestGroup.conversation) ? null : key;
}

export function findGroupIndex(
  groups: { conversation: Conversation | null; interactions: Interaction[] }[],
  interaction: Interaction
): number {
  const key = interactionKey(interaction);
  return groups.findIndex(g => groupKey(g) === key);
}

export function appendDedupe(
  groups: ConversationGroupState[],
  index: number,
  interaction: Interaction,
  conversation: Conversation | null
): ConversationGroupState[] {
  const group = groups[index];
  if (group.interactions.some(i => i.id === interaction.id)) {
    return groups;
  }
  const next = [...groups];
  next[index] = {
    ...group,
    conversation: conversation ?? group.conversation,
    interactions: [...group.interactions, interaction],
  };
  return next;
}

export function getConversationTitle(group: ConversationGroupView): string {
  if (group.isActive) return 'Active Conversation';
  if (group.conversation?.topic_summary) return group.conversation.topic_summary;
  if (!group.conversation && group.interactions.length > 0) return 'Untitled Conversation';
  return 'Conversation';
}
