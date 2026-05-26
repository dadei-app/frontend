import type { Interaction } from '@dadei/ui/types/models.types';
import { formatLocalTime } from './conversationUtils';
import SplitDeleteToolbar from '@dadei/ui/components/ui/SplitDeleteToolbar';

type PersonColor = { background: string; border: string; text: string };

export default function InteractionCard({
  interaction,
  getPersonDisplay,
  getPersonColor,
  armedInteractionDeleteId,
  setArmedInteractionDeleteId,
  setArmedConversationDeleteId,
  handleDeleteInteraction,
}: {
  interaction: Interaction;
  getPersonDisplay: (personId: string) => { label: string; index: number };
  getPersonColor: (personIndex: number) => PersonColor;
  armedInteractionDeleteId: string | null;
  setArmedInteractionDeleteId: (id: string | null) => void;
  setArmedConversationDeleteId: (id: string | null) => void;
  handleDeleteInteraction: (interactionId: string) => void;
}) {
  const person = getPersonDisplay(interaction.person_id);
  const colors = getPersonColor(person.index);

  return (
    <div className="group/interaction overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70 transition-[border-color,box-shadow] duration-200 hover:border-emerald-500/25 hover:shadow-sm">
      <div className="flex min-w-0 items-center gap-3 p-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-md font-bold text-white"
          style={{ backgroundColor: colors.border }}
        >
          {person.label[0].toUpperCase()}
        </div>

        <div className="min-w-0 flex-1 self-center py-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-secondary">
            <span className="text-sm font-semibold" style={{ color: colors.text }}>
              {person.label}
            </span>
            <span className="text-xs tabular-nums text-zinc-500">
              {formatLocalTime(interaction.timestamp)}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-200 wrap-anywhere font-secondary">
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
    </div>
  );
}
