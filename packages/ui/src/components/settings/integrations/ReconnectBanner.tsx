import { AlertTriangle } from 'lucide-react';

const LABEL: Record<string, string> = { google: 'Google', microsoft: 'Microsoft', apple: 'Apple' };

export function ReconnectBanner({
  providers,
  onReconnect,
}: {
  providers: string[];
  onReconnect: (provider: string) => void;
}) {
  if (providers.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 backdrop-blur-md">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
      <p className="flex-1 font-secondary text-xs leading-relaxed text-amber-100/90">
        {providers.length === 1
          ? `Your ${LABEL[providers[0]] ?? providers[0]} connection expired — reconnect to keep that account active.`
          : `Some connections expired (${providers.map(p => LABEL[p] ?? p).join(', ')}) — reconnect to keep them active.`}
        {' '}Your dadei account and memories are unaffected.
      </p>
      <div className="flex shrink-0 gap-2">
        {providers.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onReconnect(p)}
            className="rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1.5 font-secondary text-xs font-medium text-amber-50 transition-colors hover:bg-amber-500/30"
          >
            Reconnect {LABEL[p] ?? p}
          </button>
        ))}
      </div>
    </div>
  );
}
