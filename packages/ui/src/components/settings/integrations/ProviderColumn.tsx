import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import type { ProviderHealth } from '@dadei/ui/types/integrations.types';
import { IntegrationCard } from './IntegrationCard';
import { workspaceServiceDisplayName } from './serviceDisplayNames';

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
};

function emailsMatch(accountEmail: string | null | undefined, networkEmail: string) {
  if (!accountEmail) return true;
  return accountEmail.trim().toLowerCase() === networkEmail.trim().toLowerCase();
}

function CrossfadeHoverLabel({
  idle,
  hover,
  active,
}: {
  idle: string;
  hover: string;
  active: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <span className="grid w-full [&>*]:col-start-1 [&>*]:row-start-1">
      <motion.span
        className="truncate"
        aria-hidden={active}
        initial={false}
        animate={{ opacity: active ? 0 : 1 }}
        transition={transition}
      >
        {idle}
      </motion.span>
      <motion.span
        className="truncate"
        aria-hidden={!active}
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={transition}
      >
        {hover}
      </motion.span>
    </span>
  );
}

export function ProviderColumn({
  health,
  networkEmail,
  hasPassword,
  connectedProviderCount,
  connecting,
  disconnecting,
  disconnectPending = false,
  onConnect,
  onDisconnect,
}: {
  health: ProviderHealth;
  networkEmail: string;
  hasPassword: boolean;
  connectedProviderCount: number;
  connecting: boolean;
  disconnecting: boolean;
  disconnectPending?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [ctaHovered, setCtaHovered] = useState(false);
  const comingSoon = health.provider === 'apple';
  const label = PROVIDER_LABEL[health.provider] ?? health.provider;
  const canDisconnect = hasPassword || connectedProviderCount > 1;
  const isHealthyConnected = health.connected && !health.needs_reauth;
  const needsPasswordToDisconnect = isHealthyConnected && !canDisconnect;
  const emailMismatch =
    isHealthyConnected &&
    Boolean(health.account_identifier) &&
    !emailsMatch(health.account_identifier, networkEmail);

  const statusLabel = emailMismatch
    ? `Connected to ${health.account_identifier}`
    : 'Connected';

  const cta = !health.connected
    ? `Connect ${label}`
    : health.needs_reauth
      ? `Reconnect ${label}`
      : statusLabel;

  const showDisconnectHover =
    isHealthyConnected && canDisconnect && !needsPasswordToDisconnect && (ctaHovered || disconnectPending);

  const ctaTone = health.needs_reauth
    ? 'border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25'
    : isHealthyConnected
      ? needsPasswordToDisconnect
        ? 'group border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90 hover:border-zinc-500/35 hover:bg-zinc-700/40 hover:text-zinc-200'
        : showDisconnectHover
          ? 'border-rose-400/45 bg-rose-500/15 text-rose-100'
          : 'group border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90 hover:border-rose-400/45 hover:bg-rose-500/15 hover:text-rose-100'
      : 'border-white/10 bg-zinc-900/55 text-zinc-100 hover:bg-zinc-800/65';

  const actionButton = comingSoon ? (
    <span
      className={cn(
        'flex max-w-[13rem] shrink-0 cursor-default items-center gap-2 rounded-lg border px-3 py-1.5 font-secondary text-xs font-medium',
        'border-zinc-500/25 bg-zinc-800/50 text-zinc-400',
      )}
    >
      Coming soon
    </span>
  ) : (
    <button
      type="button"
      disabled={connecting || disconnecting}
      onMouseEnter={() => setCtaHovered(true)}
      onMouseLeave={() => setCtaHovered(false)}
      onFocus={() => setCtaHovered(true)}
      onBlur={() => setCtaHovered(false)}
      onClick={() => {
        if (connecting || disconnecting) return;
        if (needsPasswordToDisconnect) return;
        if (isHealthyConnected && canDisconnect) {
          onDisconnect();
          return;
        }
        if (!isHealthyConnected) onConnect();
      }}
      title={emailMismatch ? health.account_identifier ?? undefined : undefined}
      className={cn(
        'flex max-w-[13rem] shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 font-secondary text-xs font-medium',
        'transition-[color,background-color,border-color,box-shadow] duration-300 ease-in-out motion-reduce:transition-none',
        'disabled:cursor-default disabled:opacity-100',
        ctaTone,
      )}
    >
      {connecting || disconnecting ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      ) : null}
      <span className="min-w-0 flex-1 truncate">
        {connecting ? 'Connecting…' : disconnecting ? 'Disconnecting…' : null}
        {!connecting && !disconnecting ? (
          isHealthyConnected ? (
            <CrossfadeHoverLabel
              idle={cta}
              hover={needsPasswordToDisconnect ? 'Set password' : 'Disconnect'}
              active={needsPasswordToDisconnect ? ctaHovered : ctaHovered || disconnectPending}
            />
          ) : (
            cta
          )
        ) : null}
      </span>
    </button>
  );

  return (
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/35 p-3.5 backdrop-blur-md',
        comingSoon && 'overflow-hidden',
      )}
      aria-label={comingSoon ? `${label} — coming soon` : undefined}
    >
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col gap-3',
          comingSoon && 'pointer-events-none select-none opacity-35 blur-[0.4px]',
        )}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <span className="font-primary text-sm font-semibold tracking-wide text-zinc-100">{label}</span>
          {actionButton}
        </div>
        <div className="grid auto-rows-min grid-cols-2 gap-2">
          {health.services.map(svc => (
            <IntegrationCard
              key={svc.id}
              name={workspaceServiceDisplayName(svc.id, health.provider)}
              description={`${svc.read ? 'read' : ''}${svc.read && svc.write ? ' · ' : ''}${svc.write ? 'write' : ''}` || '—'}
              status={!health.connected ? 'off' : svc.status === 'connected' ? 'on' : svc.status === 'needs_reauth' ? 'reauth' : 'off'}
            />
          ))}
        </div>
      </div>

      {comingSoon ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-zinc-950/50 backdrop-blur-[3px]">
          <div className="mx-3 flex max-w-[15rem] flex-col items-center gap-2.5 rounded-2xl border border-white/12 bg-zinc-900/85 px-5 py-4 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-500/30 bg-zinc-800/80">
              <Sparkles className="h-4 w-4 text-zinc-200" aria-hidden />
            </span>
            <div>
              <p className="font-primary text-sm font-semibold tracking-wide text-zinc-50">Coming soon</p>
              <p className="mt-1 font-secondary text-[11px] leading-relaxed text-zinc-400">
                iCloud Mail, Calendar &amp; Contacts — we&apos;re finishing Apple support.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
