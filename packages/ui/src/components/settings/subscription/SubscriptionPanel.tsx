import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
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

function usageFromLimits(limits: SubscriptionLimitsView, remaining: number | null) {
  const limit = limits.daily_command_limit;
  if (limit == null) return null;
  const used = remaining == null ? 0 : Math.max(0, limit - remaining);
  return { used, limit };
}

/** Emerald under 60%, amber 60-90%, rose at/over 90%. */
function meterFillClass(ratio: number): string {
  if (ratio >= 0.9) return 'bg-rose-500';
  if (ratio >= 0.6) return 'bg-amber-400';
  return 'bg-emerald-500';
}

type PillTone = 'free' | 'active' | 'cancel' | 'pastdue';

function StatusPill({ tone, label, pro }: { tone: PillTone; label: string; pro: boolean }) {
  const toneClass: Record<PillTone, string> = {
    free: 'border-white/10 bg-white/[0.04] text-zinc-400',
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    cancel: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    pastdue: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
        toneClass[tone],
      )}
    >
      {pro ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : null}
      {label}
    </span>
  );
}

function BenefitRow({ label, free }: { label: string; free: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
        <Check className="h-3 w-3 text-emerald-300" aria-hidden />
      </span>
      <span className="text-sm text-zinc-200">{label}</span>
      <span className="ml-auto text-xs text-zinc-600 font-secondary">{free} &rarr; &infin;</span>
    </div>
  );
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

  const status = useMemo<{ tone: PillTone; label: string }>(() => {
    if (!sub) return { tone: 'free', label: '' };
    if (sub.cancel_at_period_end) {
      const end = formatPeriodEnd(sub.current_period_end, timeZone);
      return { tone: 'cancel', label: end ? `Cancels ${end}` : 'Cancels soon' };
    }
    if (sub.status === 'past_due') return { tone: 'pastdue', label: 'Past due' };
    if (sub.status === 'active') return { tone: isPro ? 'active' : 'free', label: 'Active' };
    return { tone: 'free', label: sub.status.replace(/_/g, ' ') };
  }, [isPro, sub, timeZone]);

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
        <p className="text-sm text-zinc-500 font-secondary">Loading subscription&hellip;</p>
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

  const busy = actionPending || isFetching;
  const meterRatio = usage ? Math.min(1, usage.used / Math.max(usage.limit, 1)) : 0;

  return (
    <div className="mx-auto grid h-full w-full max-w-4xl grid-cols-1 content-center gap-5 px-2 py-6 lg:grid-cols-5 lg:items-stretch">
      {/* Block 1 - hero plan card */}
      <div className="settings-tile flex flex-col rounded-xl border border-white/10 bg-zinc-950/55 p-6 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl leading-none text-zinc-100">{sub.display_name}</h2>
            {renewalLine ? (
              <p className="mt-2 text-xs text-zinc-500 font-secondary">{renewalLine}</p>
            ) : (
              <p className="mt-2 text-xs text-zinc-600 font-secondary">
                {isPro ? 'Your active plan' : 'Your current plan'}
              </p>
            )}
          </div>
          <StatusPill tone={status.tone} label={status.label} pro={isPro} />
        </div>

        {!isPro && usage ? (
          <div className="mt-auto pt-8">
            <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500 font-secondary">
              <span>Commands today</span>
              <span className="tabular-nums text-zinc-400">
                {usage.used} / {usage.limit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn('h-full rounded-full transition-all', meterFillClass(meterRatio))}
                style={{ width: `${meterRatio * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Block 2 - Pro card */}
      {isPro ? (
        <div className="settings-tile flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-zinc-950/55 p-8 text-center lg:col-span-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <Check className="h-7 w-7 text-emerald-300" aria-hidden />
          </span>
          <div>
            <p className="font-display text-xl text-zinc-100">You&rsquo;re on Pro</p>
            <p className="mt-1 text-sm text-zinc-500 font-secondary">Everything unlocked.</p>
          </div>
          <button
            type="button"
            className={cn(settingsButtonClass, 'mt-2 w-full max-w-xs')}
            disabled={busy}
            onClick={() => void openPortal()}
          >
            {actionPending ? 'Opening…' : 'Manage billing'}
          </button>
        </div>
      ) : (
        <div className="relative flex flex-col overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.4)] lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden />
              <span className="font-display text-2xl text-zinc-100">Pro</span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-3xl text-zinc-100">$15</span>
              <span className="text-sm text-zinc-500 font-secondary">/mo</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3.5">
            <BenefitRow label="Unlimited commands" free={String(sub.limits.daily_command_limit ?? 5)} />
            <BenefitRow label="Unlimited devices" free={String(sub.limits.max_devices ?? 1)} />
            <BenefitRow label="Unlimited people" free={String(sub.limits.max_persons ?? 5)} />
          </div>

          <button
            type="button"
            className={cn(settingsPrimaryButtonClass, 'mt-auto w-full')}
            disabled={busy}
            onClick={() => void startCheckout()}
          >
            {actionPending ? 'Redirecting…' : 'Upgrade to Pro — $15/mo'}
          </button>
        </div>
      )}
    </div>
  );
}