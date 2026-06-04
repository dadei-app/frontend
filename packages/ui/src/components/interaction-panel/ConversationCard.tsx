import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ConversationGroupView } from './types';
import { accordionEase } from './constants';
import { formatLocalDate, getConversationTitle } from './conversationUtils';
import SplitDeleteToolbar from '@dadei/ui/components/ui/SplitDeleteToolbar';
import InteractionCard from './InteractionCard';

function ConversationExpandedSummary({ group }: { group: ConversationGroupView }) {
  const topic = group.conversation?.topic_summary?.trim();
  const context = group.conversation?.context_summary?.trim();
  if (!topic && !context) return null;
  return (
    <div className="border-b border-white/8 bg-zinc-950/40 px-4 py-3 font-secondary">
      <p className="whitespace-normal text-pretty text-sm leading-relaxed text-zinc-500 wrap-anywhere">
        {context}
      </p>
    </div>
  );
}

function CollapsibleConversationBody({
  expanded,
  interactionKey,
  prefersReducedMotion,
  onInnerClick,
  children,
}: {
  expanded: boolean;
  interactionKey: string;
  prefersReducedMotion: boolean;
  onInnerClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [interactionKey, expanded]);

  const duration = prefersReducedMotion ? 0.01 : 0.34;

  return (
    <motion.div
      initial={false}
      animate={{ height: expanded ? contentHeight : 0 }}
      transition={{ duration, ease: accordionEase }}
      className="w-full min-w-0 overflow-hidden"
      onClick={onInnerClick}
    >
      <div ref={innerRef} className="min-w-0" {...(!expanded ? { inert: true as const } : {})}>
        <div className="w-full min-w-0 space-y-2 bg-zinc-900/25 p-4">{children}</div>
      </div>
    </motion.div>
  );
}

export default function ConversationCard({
  group,
  groupIndex,
  prefersReducedMotion,
  armedConversationDeleteId,
  armedInteractionDeleteId,
  setArmedConversationDeleteId,
  setArmedInteractionDeleteId,
  toggleConversation,
  handleDeleteConversation,
  handleDeleteInteraction,
  getPersonDisplay,
}: {
  group: ConversationGroupView;
  groupIndex: number;
  prefersReducedMotion: boolean;
  armedConversationDeleteId: string | null;
  armedInteractionDeleteId: string | null;
  setArmedConversationDeleteId: (id: string | null) => void;
  setArmedInteractionDeleteId: (id: string | null) => void;
  toggleConversation: (index: number) => void;
  handleDeleteConversation: (conversationId: string) => void;
  handleDeleteInteraction: (interactionId: string) => void;
  getPersonDisplay: (personId: string) => { label: string; position: number; isUser: boolean };
}) {
  const conversationIdForActions =
    group.conversation?.id?.trim() ||
    group.interactions.find(i => i.conversation_id?.trim())?.conversation_id?.trim() ||
    '';

  const tutorialConversationTarget =
    group.conversation?.id === 'tutorial-test-conversation' ||
    group.interactions.some(i => i.conversation_id === 'tutorial-test-conversation')
      ? 'tutorial-test-conversation'
      : undefined;

  return (
    <div
      data-tutorial-target={tutorialConversationTarget}
      role="button"
      tabIndex={0}
      aria-expanded={group.isExpanded}
      onClick={() => toggleConversation(groupIndex)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleConversation(groupIndex);
        }
      }}
      className="group/conv w-full min-w-0 max-w-full cursor-pointer overflow-hidden rounded-xl border border-white/6 bg-zinc-950/50 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] translate-y-0 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-white/10 hover:shadow-[0_10px_32px_-12px_rgba(0,0,0,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      <div className="flex w-full min-w-0 items-center gap-3 border-b border-white/6 bg-zinc-950/95 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/conv:text-zinc-400"
            aria-hidden
          >
            <i
              className={`fas fa-chevron-down text-xs leading-none transition-[rotate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${group.isExpanded ? 'rotate-0' : '-rotate-90'}`}
            />
          </span>

          {group.isActive ? (
            <span
              className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400"
              aria-hidden
            />
          ) : null}

          <div className="min-w-0 flex-1 overflow-hidden py-0.5">
            <h3 className="text-md font-semibold text-zinc-100">
              <span className="block truncate" title={getConversationTitle(group)}>
                {getConversationTitle(group)}
              </span>
            </h3>
          </div>

          <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 text-sm text-zinc-500 font-secondary sm:flex-row sm:items-center sm:gap-4">
            <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
              <i className="fas fa-comment text-[11px] opacity-80" aria-hidden />
              {group.interactions.length}
            </span>
            <span className="whitespace-nowrap">
              {formatLocalDate(group.conversation?.started_at || group.interactions[0]?.timestamp)}
            </span>
          </div>
        </div>

        {conversationIdForActions ? (
          <SplitDeleteToolbar
            armed={armedConversationDeleteId === conversationIdForActions}
            onArm={() => {
              setArmedInteractionDeleteId(null);
              setArmedConversationDeleteId(conversationIdForActions);
            }}
            onDisarm={() => setArmedConversationDeleteId(null)}
            onConfirm={() => {
              void handleDeleteConversation(conversationIdForActions);
            }}
            idleTitle="Delete conversation"
            idleAriaLabel="Delete conversation"
            idleVisibleClassName="group-hover/conv:opacity-100"
          />
        ) : null}
      </div>

      <ConversationExpandedSummary group={group} />

      <CollapsibleConversationBody
        expanded={group.isExpanded}
        interactionKey={`${group.interactions.map(i => i.id).join('\u037e')}|${group.conversation?.topic_summary ?? ''}|${group.conversation?.context_summary ?? ''}`}
        prefersReducedMotion={!!prefersReducedMotion}
        onInnerClick={e => e.stopPropagation()}
      >
        {group.interactions.map(interaction => (
          <InteractionCard
            key={interaction.id}
            interaction={interaction}
            getPersonDisplay={getPersonDisplay}
            armedInteractionDeleteId={armedInteractionDeleteId}
            setArmedInteractionDeleteId={setArmedInteractionDeleteId}
            setArmedConversationDeleteId={setArmedConversationDeleteId}
            handleDeleteInteraction={handleDeleteInteraction}
          />
        ))}
      </CollapsibleConversationBody>
    </div>
  );
}
