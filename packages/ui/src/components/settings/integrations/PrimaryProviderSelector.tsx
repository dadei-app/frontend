import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

type Domain = 'mail' | 'calendar' | 'contacts';

const DOMAIN_LABEL: Record<Domain, string> = {
  mail: 'Mail',
  calendar: 'Calendar',
  contacts: 'Contacts',
};

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
};

const PROVIDER_RING_SPRING = { type: 'spring' as const, stiffness: 380, damping: 34 };

function SlidingPillTrack({
  domain,
  connectedProviders,
  value,
  saving,
  onSelect,
}: {
  domain: Domain;
  connectedProviders: string[];
  value: string | null;
  saving: boolean;
  onSelect: (provider: string) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={`${DOMAIN_LABEL[domain]} default account`}
      className={cn(
        'relative inline-flex shrink-0 self-start rounded-full border border-white/10 bg-zinc-950/70 p-1',
        saving && 'pointer-events-none',
      )}
    >
      {connectedProviders.map(provider => {
        const selected = value === provider;
        const label = PROVIDER_LABEL[provider] ?? provider[0].toUpperCase() + provider.slice(1);

        return (
          <button
            key={provider}
            type="button"
            disabled={saving}
            aria-pressed={selected}
            onClick={() => onSelect(provider)}
            className={cn(
              'relative min-w-[5.5rem] rounded-full px-4 py-1.5 text-sm font-medium',
              'transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
              selected ? 'text-emerald-100' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`primary-provider-ring-${domain}`}
                className="pointer-events-none absolute inset-0 rounded-full border border-emerald-400/35 bg-emerald-500/10 shadow-[0_0_28px_-12px_rgba(16,185,129,0.55)]"
                transition={reduceMotion ? { duration: 0 } : PROVIDER_RING_SPRING}
              />
            ) : null}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PrimaryProviderSelector({
  domain,
  connectedProviders,
  value,
  saving,
  onChange,
}: {
  domain: Domain;
  connectedProviders: string[];
  value: string | null;
  saving: boolean;
  onChange: (provider: string | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  if (connectedProviders.length < 2) return null;

  const handleSelect = (provider: string) => {
    const next = localValue === provider ? null : provider;
    setLocalValue(next);
    onChange(next);
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/35 px-3.5 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-primary text-sm text-zinc-100">{DOMAIN_LABEL[domain]} — default account</p>
        <p className="font-secondary text-xs text-zinc-500">
          {localValue
            ? `New ${domain} actions use ${PROVIDER_LABEL[localValue] ?? localValue}. Tap again to clear.`
            : `Choose where new ${domain} actions go, or leave unset.`}
        </p>
      </div>

      <SlidingPillTrack
        domain={domain}
        connectedProviders={connectedProviders}
        value={localValue}
        saving={saving}
        onSelect={handleSelect}
      />
    </motion.div>
  );
}
