import type { Interaction } from '@dadei/ui/types/models.types';
import { formatLocalTime } from './conversationUtils';
import SplitDeleteToolbar from '@dadei/ui/components/ui/SplitDeleteToolbar';

export default function InteractionCard({
  interaction,
  getPersonDisplay,
  armedInteractionDeleteId,
  setArmedInteractionDeleteId,
  setArmedConversationDeleteId,
  handleDeleteInteraction,
}: {
  interaction: Interaction;
  getPersonDisplay: (personId: string) => { label: string; index: number };
  armedInteractionDeleteId: string | null;
  setArmedInteractionDeleteId: (id: string | null) => void;
  setArmedConversationDeleteId: (id: string | null) => void;
  handleDeleteInteraction: (interactionId: string) => void;
}) {
  const person = getPersonDisplay(interaction.person_id);
  const isOwner = person.index === 1;

  return (
    <div
      className={`group/interaction flex min-w-0 items-center gap-3 border-l-2 pl-3 py-1.5 transition-colors ${isOwner ? 'border-emerald-500/40 hover:border-emerald-500/70' : 'border-zinc-700/40 hover:border-zinc-600'}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ${isOwner ? 'bg-emerald-950/60 text-emerald-300 ring-emerald-500/25' : 'bg-zinc-800 text-zinc-300 ring-white/5'}`}
      >
        {person.label[0].toUpperCase()}
      </div>

      <div className="min-w-0 flex-1 self-center py-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-secondary">
          <span
            className={`text-xs font-medium tracking-wide ${isOwner ? 'text-emerald-300/80' : 'text-zinc-400'}`}
          >
            {person.label}
          </span>
          <span className="text-[10px] tabular-nums text-zinc-600">
            {formatLocalTime(interaction.timestamp)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-zinc-200 wrap-anywhere">
          {interaction.text}
        </p>
      </div>

      <SplitDeleteToolbar
        armed={armedInteractionDeleteId === interaction.id}
        onArm={() => {
          setArmedConversationDeleteId(null);
          setArmedInteractionDeleteId(interaction.id);
        }}
        onDisarm={() => setArmedInteractionDeleteId(null)}
        onConfirm={() => {
          void handleDeleteInteraction(interaction.id);
        }}
        idleTitle="Delete interaction"
        idleAriaLabel="Delete interaction"
        idleVisibleClassName="group-hover/interaction:opacity-100"
      />
    </div>
  );
}
