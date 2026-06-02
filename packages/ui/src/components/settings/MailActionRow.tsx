import SplitDeleteToolbar from '@dadei/ui/components/ui/SplitDeleteToolbar';
import type { NetworkAction } from '@dadei/ui/types/models.types';
import { actionDisplayTitle, formatActionWhen, mailActionMeta } from '@dadei/ui/utils/actionDisplay';

type MailActionRowProps = {
  action: NetworkAction;
  armed: boolean;
  disabled: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onConfirm: () => void;
};

export function MailActionRow({
  action,
  armed,
  disabled,
  onArm,
  onDisarm,
  onConfirm,
}: MailActionRowProps) {
  return (
    <li className="group/action rounded-lg border border-white/7 bg-zinc-950/40 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm leading-snug text-zinc-100"
            title={`Recorded ${formatActionWhen(action.created_at) ?? action.created_at}`}
          >
            {actionDisplayTitle(action)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 font-secondary">{mailActionMeta(action)}</p>
        </div>
        <SplitDeleteToolbar
          armed={armed}
          disabled={disabled}
          onArm={onArm}
          onDisarm={onDisarm}
          onConfirm={onConfirm}
          idleTitle="Delete action"
          idleAriaLabel="Delete action"
          idleVisibleClassName="group-hover/action:opacity-100"
        />
      </div>
    </li>
  );
}
