import type { SideEffectDeleteBodyProps } from './types';
import { CompactTitle, strArg } from './shared';

export default function PersonDeleteBody({
  title,
  body,
  toolArgs,
  compact = false,
}: SideEffectDeleteBodyProps) {
  const name = strArg(toolArgs, 'name') ?? title;
  const note = body ?? strArg(toolArgs, 'note');

  if (compact) return <CompactTitle title={name} />;

  return (
    <div className="mt-1 min-w-0">
      <p className="text-sm font-semibold leading-snug text-zinc-100">{name}</p>
      <p className="mt-0.5 text-xs text-rose-300/80 font-secondary">
        This person and their interactions will be removed
      </p>
      {note ? (
        <p className="mt-2 border-t border-white/6 pt-2 text-xs leading-relaxed text-zinc-400 font-secondary">
          {note}
        </p>
      ) : null}
    </div>
  );
}
