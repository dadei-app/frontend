import { Sparkles } from 'lucide-react';
import { SettingsBento } from '@dadei/ui/components/settings/layout';

export function SubscriptionPanel() {
  return (
    <SettingsBento centered>
      <Sparkles className="h-10 w-10 text-emerald-400/70" />
      <h2 className="font-brand text-2xl text-zinc-100">Subscription</h2>
      <p className="max-w-md text-base text-zinc-500 font-secondary">
        Plan management is coming in the next update.
      </p>
    </SettingsBento>
  );
}
