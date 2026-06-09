import SplitDeleteToolbar from '@dadei/ui/components/ui/SplitDeleteToolbar';
import type { EpisodicMemory } from '@dadei/ui/types/models.types';
import {
  firstEvidenceQuote,
  formatActionWhen,
  formatConfidence,
  formatMetaLine,
} from '@dadei/ui/utils/actionDisplay';

type MemorySettingsRowProps = {
  memory: EpisodicMemory;
  armed: boolean;
  disabled: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onConfirm: () => void;
};

export function MemorySettingsRow({
  memory,
  armed,
  disabled,
  onArm,
  onDisarm,
  onConfirm,
}: MemorySettingsRowProps) {
  const evidence = firstEvidenceQuote(memory.provenance);

  return (
    <li className="group/memory rounded-lg border border-white/8 bg-zinc-900/55 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium leading-snug text-zinc-100"
            title={`Recorded ${formatActionWhen(memory.created_at) ?? memory.created_at}`}
          >
            {memory.canonical_text}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 font-secondary">
            {formatMetaLine([
              memory.memory_type,
              memory.status,
              formatConfidence(memory.confidence),
              memory.expires_at ? `Expires ${formatActionWhen(memory.expires_at)}` : null,
              evidence ? `"${evidence}"` : null,
            ])}
          </p>
        </div>
        <SplitDeleteToolbar
          armed={armed}
          disabled={disabled}
          onArm={onArm}
          onDisarm={onDisarm}
          onConfirm={onConfirm}
          idleTitle="Delete memory"
          idleAriaLabel="Delete memory"
          idleVisibleClassName="group-hover/memory:opacity-100"
        />
      </div>
    </li>
  );
}
