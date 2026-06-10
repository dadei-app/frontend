import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import type { ConversationGroupView } from './types';
import { accordionEase } from './constants';
import { formatLocalDate, getConversationTitle } from './conversationUtils';
import SplitDeleteToolbar from '@dadei/ui/components/ui/SplitDeleteToolbar';
import InteractionCard from './InteractionCard';
import { useTutorialTargetInteractive } from '@dadei/ui/contexts/TutorialContext';
import { useMobileAssistant } from '@dadei/ui/lib/hooks/useMobileAssistant';
import { cn } from '@dadei/ui/lib/shared/cn';

const HEADER_META_EASE = 'duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]';

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
  const interactive = useTutorialTargetInteractive(tutorialConversationTarget);
  const isDeleteArmed = armedConversationDeleteId === conversationIdForActions;
  const isMobileAssistant = useMobileAssistant();

  return (
    <div
      data-tutorial-target={tutorialConversationTarget}
      role="button"
      tabIndex={0}
      aria-expanded={group.isExpanded}
      onClick={() => {
        if (!interactive) return;
        toggleConversation(groupIndex);
      }}
      onKeyDown={e => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleConversation(groupIndex);
        }
      }}
      className={cn(
        'group/conv w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-white/6 bg-zinc-950/50 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] translate-y-0 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-white/10 hover:shadow-[0_10px_32px_-12px_rgba(0,0,0,0.65)]',
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-4 border-b border-white/6 bg-zinc-950/95 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              interactive && 'group-hover/conv:text-zinc-400',
            )}
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
        </div>

        <div className="flex shrink-0 items-center gap-4 text-sm text-zinc-500 font-secondary">
          <span
            className="inline-flex items-center gap-1 rounded-md border border-white/6 bg-white/[0.03] px-1.5 py-0.5 text-xs tabular-nums text-zinc-400"
            title={`${group.interactions.length} interaction${group.interactions.length === 1 ? '' : 's'}`}
            aria-label={`${group.interactions.length} interaction${group.interactions.length === 1 ? '' : 's'}`}
          >
            <MessageSquare className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden strokeWidth={2} />
            {group.interactions.length}
          </span>
          <span className="whitespace-nowrap">
            {formatLocalDate(group.conversation?.started_at || group.interactions[0]?.timestamp)}
          </span>
        </div>

        {conversationIdForActions ? (
          <div
            className={cn(
              'shrink-0',
              !isMobileAssistant && [
                'transition-[opacity,margin] pointer-events-none',
                HEADER_META_EASE,
                prefersReducedMotion && '!duration-0',
                interactive &&
                  !isDeleteArmed &&
                  'max-w-0 overflow-hidden opacity-0 -ml-4 group-hover/conv:ml-0 group-hover/conv:max-w-none group-hover/conv:overflow-visible group-hover/conv:opacity-100 group-hover/conv:pointer-events-auto',
                isDeleteArmed && 'ml-0 max-w-none overflow-visible opacity-100 pointer-events-auto',
                !interactive && 'max-w-0 overflow-hidden opacity-0 -ml-4',
              ],
            )}
          >
            <SplitDeleteToolbar
              armed={isDeleteArmed}
              disabled={!interactive}
              alwaysVisible={interactive && isMobileAssistant}
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
              idleVisibleClassName={
                interactive && !isMobileAssistant ? 'group-hover/conv:opacity-100' : undefined
              }
              idleButtonClassName={
                isMobileAssistant ? 'text-rose-400/90 hover:bg-rose-500/10' : undefined
              }
            />
          </div>
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
