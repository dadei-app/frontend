import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  SettingsBento,
  settingsButtonClass,
  settingsPrimaryButtonClass,
  type SettingsPanelProps,
} from '@dadei/ui/components/settings/layout';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { subscriptionApi } from '@dadei/ui/lib/workspace/api/subscription';
import {
  invalidateSubscription,
  useSubscription,
} from '@dadei/ui/lib/platform/query/queryHooks';
import { formatForUser } from '@dadei/ui/lib/platform/shared/time';
import { getUserErrorMessage } from '@dadei/ui/lib/platform/errors/userMessage';
import type { SubscriptionLimitsView } from '@dadei/ui/types/subscription.types';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

function formatLimit(value: number | null | undefined): string {
  return value == null ? 'Unlimited' : String(value);
}

function formatPeriodEnd(iso: string | null | undefined, timeZone: string): string | null {
  if (!iso) return null;
  try {
    return formatForUser(iso, timeZone, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function TierCompareCell({
  label,
  freeValue,
  proValue,
}: {
  label: string;
  freeValue: string;
  proValue: string;
}) {
  return (
    <div className="settings-tile rounded-lg border border-white/10 bg-zinc-950/55 p-3 text-left">
      <p className="text-xs text-zinc-500 font-secondary">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-zinc-600">Free</p>
          <p className="text-zinc-300">{freeValue}</p>
        </div>
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-emerald-600/80">Pro</p>
          <p className="text-emerald-200/90">{proValue}</p>
        </div>
      </div>
    </div>
  );
}

function usageFromLimits(limits: SubscriptionLimitsView, remaining: number | null) {
  const limit = limits.daily_command_limit;
  if (limit == null) return null;
  const used = remaining == null ? 0 : Math.max(0, limit - remaining);
  return { used, limit };
}

export function SubscriptionPanel({ pendingAction, onActionConsumed }: SettingsPanelProps) {
  const { isElectron } = useSystem();
  const { showToast } = useNotifications();
  const queryClient = useQueryClient();
  const client = isElectron ? 'desktop' : 'web';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const { data: sub, isLoading, isError, refetch, isFetching } = useSubscription();
  const [actionPending, setActionPending] = useState(false);

  const isPro = sub?.tier === 'pro';
  const usage = sub ? usageFromLimits(sub.limits, sub.commands_remaining_today) : null;

  const statusLine = useMemo(() => {
    if (!sub) return '';
    if (sub.cancel_at_period_end) {
      const end = formatPeriodEnd(sub.current_period_end, timeZone);
      return end ? `Cancels ${end}` : 'Cancels at period end';
    }
    if (sub.status === 'active') return 'Active';
    if (sub.status === 'past_due') return 'Past due';
    return sub.status.replace(/_/g, ' ');
  }, [sub, timeZone]);

  const renewalLine = useMemo(() => {
    if (!sub?.current_period_end || !isPro) return null;
    const end = formatPeriodEnd(sub.current_period_end, timeZone);
    if (!end) return null;
    return sub.cancel_at_period_end ? `Access until ${end}` : `Renews ${end}`;
  }, [isPro, sub, timeZone]);

  const handleBillingReturn = useCallback(
    async (action: string) => {
      if (action === 'billing-success') {
        await invalidateSubscription(queryClient);
        showToast("You're on Pro now.", 'success');
      } else if (action === 'billing-cancel') {
        showToast('Checkout canceled.', 'info');
      }
      onActionConsumed?.();
    },
    [onActionConsumed, queryClient, showToast],
  );

  useEffect(() => {
    if (!pendingAction) return;
    if (pendingAction === 'billing-success' || pendingAction === 'billing-cancel') {
      void handleBillingReturn(pendingAction);
    }
  }, [handleBillingReturn, pendingAction]);

  const startCheckout = async () => {
    setActionPending(true);
    try {
      const { url } = await subscriptionApi.createCheckout(client);
      if (client === 'desktop' && window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
      } else {
        window.location.assign(url);
      }
    } catch (error) {
      showToast(getUserErrorMessage(error), 'error');
    } finally {
      setActionPending(false);
    }
  };

  const openPortal = async () => {
    setActionPending(true);
    try {
      const { url } = await subscriptionApi.createPortal(client);
      if (client === 'desktop' && window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
      } else {
        window.location.assign(url);
      }
    } catch (error) {
      showToast(getUserErrorMessage(error), 'error');
    } finally {
      setActionPending(false);
    }
  };

  if (isLoading) {
    return (
      <SettingsBento centered>
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" aria-hidden />
        <p className="text-sm text-zinc-500 font-secondary">Loading subscription…</p>
      </SettingsBento>
    );
  }

  if (isError || !sub) {
    return (
      <SettingsBento centered>
        <p className="text-sm text-zinc-500 font-secondary">Could not load subscription details.</p>
        <button type="button" className={settingsButtonClass} onClick={() => void refetch()}>
          Retry
        </button>
      </SettingsBento>
    );
  }

  const freeLimits = sub.limits;
  const proCommands = 'Unlimited';
  const proDevices = 'Unlimited';
  const proPersons = 'Unlimited';

  return (
    <SettingsBento centered className="max-w-lg">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-3xl text-zinc-100">{sub.display_name}</h2>
          {isPro ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Pro
            </span>
          ) : null}
        </div>
      </div>

      <div className="settings-tile w-full rounded-xl border border-white/10 bg-zinc-950/55 p-4 text-left">
        <p className="text-sm font-medium text-zinc-200">Current plan</p>
        <p className="mt-1 text-sm text-zinc-400 font-secondary capitalize">{statusLine}</p>
        {renewalLine ? (
          <p className="mt-1 text-xs text-zinc-500 font-secondary">{renewalLine}</p>
        ) : null}
      </div>

      {!isPro && usage ? (
        <div className="w-full text-left">
          <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500 font-secondary">
            <span>Commands today</span>
            <span>
              {usage.used} / {usage.limit}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(100, (usage.used / Math.max(usage.limit, 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {isPro ? (
        <button
          type="button"
          className={cn(settingsButtonClass, 'w-full max-w-xs')}
          disabled={actionPending || isFetching}
          onClick={() => void openPortal()}
        >
          {actionPending ? 'Opening…' : 'Manage billing'}
        </button>
      ) : (
        <button
          type="button"
          className={cn(settingsPrimaryButtonClass, 'w-full max-w-xs')}
          disabled={actionPending || isFetching}
          onClick={() => void startCheckout()}
        >
          {actionPending ? 'Redirecting…' : 'Upgrade to Pro — $15/mo'}
        </button>
      )}

      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
        <TierCompareCell
          label="Commands / day"
          freeValue={formatLimit(freeLimits.daily_command_limit)}
          proValue={proCommands}
        />
        <TierCompareCell
          label="Devices"
          freeValue={formatLimit(freeLimits.max_devices)}
          proValue={proDevices}
        />
        <TierCompareCell
          label="Persons"
          freeValue={formatLimit(freeLimits.max_persons)}
          proValue={proPersons}
        />
      </div>
    </SettingsBento>
  );
}
