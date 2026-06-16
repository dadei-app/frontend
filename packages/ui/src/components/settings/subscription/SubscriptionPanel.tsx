import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Infinity as InfinityIcon,
  Loader2,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  SettingsBento,
  settingsButtonClass,
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
    return formatForUser(iso, timeZone, { month: 'short', day: 'numeric', year: 'numeric' });
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

type Benefit = { Icon: typeof InfinityIcon; title: string; desc: string };

const PRO_BENEFITS: Benefit[] = [
  {
    Icon: InfinityIcon,
    title: 'Unlimited commands',
    desc: 'Talk to Dadei as much as you want — no daily cap.',
  },
  {
    Icon: Smartphone,
    title: 'Every device',
    desc: 'One presence across your laptop, desktop, and phone.',
  },
  {
    Icon: Users,
    title: 'Everyone you know',
    desc: 'Dadei remembers every person, with no limit.',
  },
];

function BenefitRow({ Icon, title, desc }: Benefit) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
        <Icon className="h-4 w-4 text-emerald-300" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 font-secondary">{desc}</p>
      </div>
    </div>
  );
}

/** Soft emerald aurora behind the hero — pure decoration. */
function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="absolute -bottom-32 left-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-400/10 blur-[110px]" />
      <div className="absolute -right-10 top-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-[110px]" />
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
  const handledBillingActionRef = useRef<string | null>(null);

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
    if (!pendingAction) {
      handledBillingActionRef.current = null;
      return;
    }
    if (pendingAction !== 'billing-success' && pendingAction !== 'billing-cancel') return;
    if (handledBillingActionRef.current === pendingAction) return;
    handledBillingActionRef.current = pendingAction;
    void handleBillingReturn(pendingAction);
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
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-5">
      <Aurora />

      <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-xl flex-col gap-4">
        {/* Context strip — current plan, subordinate to the hero */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/55 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-600">Current plan</p>
            <p className="font-display text-lg leading-tight text-zinc-100">{sub.display_name}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusPill tone={status.tone} label={status.label} pro={isPro} />
            {!isPro && usage ? (
              <span className="text-[0.7rem] tabular-nums text-zinc-500 font-secondary">
                {usage.used} / {usage.limit} commands today
              </span>
            ) : renewalLine ? (
              <span className="text-[0.7rem] text-zinc-500 font-secondary">{renewalLine}</span>
            ) : null}
          </div>
        </div>

        {!isPro && usage ? (
          <div className="h-1 overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className={cn('h-full rounded-full transition-all', meterFillClass(meterRatio))}
              style={{ width: `${meterRatio * 100}%` }}
            />
          </div>
        ) : null}

        {/* Hero */}
        {isPro ? (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-b from-emerald-500/[0.06] via-zinc-900/40 to-zinc-950/70 p-8 text-center backdrop-blur-xl shadow-[0_0_60px_-22px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_30px_-6px_rgba(16,185,129,0.6)]">
              <Check className="h-8 w-8 text-emerald-300" aria-hidden />
            </div>
            <h2 className="mt-5 font-display text-2xl text-zinc-50">You&rsquo;re on Pro</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400 font-secondary">
              Every limit lifted. Dadei is fully present &mdash; on every device, for everyone you know.
            </p>
            <button
              type="button"
              className={cn(settingsButtonClass, 'mx-auto mt-6 w-full max-w-xs')}
              disabled={busy}
              onClick={() => void openPortal()}
            >
              {actionPending ? 'Opening…' : 'Manage billing'}
            </button>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-emerald-500/[0.07] via-zinc-900/40 to-zinc-950/70 p-7 backdrop-blur-xl shadow-[0_0_70px_-24px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.07)]">
            {/* top hairline sheen */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent"
            />

            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-emerald-300/90">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Dadei Pro
                </span>
                <h2 className="mt-2 font-display text-3xl leading-tight text-zinc-50">
                  Everything, without limits.
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400 font-secondary">
                  Unlimited commands, on every device, for everyone you know.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-baseline justify-end gap-0.5">
                  <span className="font-display text-4xl leading-none text-zinc-50">$15</span>
                  <span className="text-sm text-zinc-500 font-secondary">/mo</span>
                </div>
                <p className="mt-1 text-[0.7rem] text-zinc-600 font-secondary">billed monthly</p>
              </div>
            </div>

            <div className="my-6 h-px bg-white/[0.06]" />

            <div className="flex flex-col gap-4">
              {PRO_BENEFITS.map(b => (
                <BenefitRow key={b.title} {...b} />
              ))}
            </div>

            <button
              type="button"
              className="group relative mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-3.5 text-base font-medium text-emerald-50 shadow-[0_0_34px_-8px_rgba(16,185,129,0.65)] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={() => void startCheckout()}
            >
              {actionPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Redirecting…
                </>
              ) : (
                <>
                  Upgrade to Pro
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </>
              )}
            </button>
            <p className="mt-3 text-center text-[0.7rem] text-zinc-600 font-secondary">
              Cancel anytime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
