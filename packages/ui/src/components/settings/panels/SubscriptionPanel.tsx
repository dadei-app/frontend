import { Sparkles } from 'lucide-react';

export function SubscriptionPanel() {
  return (
    <div className="conic-border glass-panel flex h-full min-h-[20rem] flex-col items-center justify-center gap-2 rounded-lg p-12 text-center">
      <Sparkles className="h-8 w-8 text-emerald-400/70" />
      <h2 className="font-brand text-lg text-zinc-100">Subscription</h2>
      <p className="max-w-md text-sm text-zinc-500 font-secondary">
        Plan management is coming in the next update.
      </p>
    </div>
  );
}
