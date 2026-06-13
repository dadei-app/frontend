import type { SideEffectDeleteBodyProps } from './types';
import { CompactTitle, numArg, strArg } from './shared';

export default function ConversationDeleteBody({
  title,
  body,
  toolArgs,
  compact = false,
}: SideEffectDeleteBodyProps) {
  const topic = strArg(toolArgs, 'topic_summary') ?? title;
  const summary = body ?? strArg(toolArgs, 'context_summary');
  const interactionCount = numArg(toolArgs, 'interaction_count');

  if (compact) return <CompactTitle title={topic} />;

  return (
    <div className="mt-1 min-w-0">
      <p className="text-sm font-semibold leading-snug text-zinc-100">{topic}</p>
      <p className="mt-0.5 text-xs text-rose-300/80 font-secondary">
        This conversation and its interactions will be removed
      </p>
      {interactionCount != null && interactionCount > 0 ? (
        <p className="mt-0.5 text-xs text-zinc-400 font-secondary">
          {interactionCount} interaction{interactionCount === 1 ? '' : 's'}
        </p>
      ) : null}
      {summary ? (
        <p className="mt-2 border-t border-white/6 pt-2 text-xs leading-relaxed text-zinc-400 font-secondary">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
