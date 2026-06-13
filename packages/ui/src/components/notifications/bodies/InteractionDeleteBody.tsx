import type { SideEffectDeleteBodyProps } from './types';
import { CompactTitle, strArg } from './shared';

export default function InteractionDeleteBody({
  title,
  body,
  toolArgs,
  compact = false,
}: SideEffectDeleteBodyProps) {
  const text = body ?? strArg(toolArgs, 'text') ?? title;
  const topic = strArg(toolArgs, 'topic_summary');

  if (compact) return <CompactTitle title={text} />;

  return (
    <div className="mt-1 min-w-0">
      <p className="text-sm font-semibold leading-snug text-zinc-100">{text}</p>
      <p className="mt-0.5 text-xs text-rose-300/80 font-secondary">This interaction will be removed</p>
      {topic ? (
        <p className="mt-0.5 text-xs text-zinc-400 font-secondary">
          <span className="text-zinc-500">Conversation</span> {topic}
        </p>
      ) : null}
    </div>
  );
}
