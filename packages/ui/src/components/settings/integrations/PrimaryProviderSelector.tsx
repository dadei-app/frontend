import { useCallback, useLayoutEffect, useRef, useState } from 'react';
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

const PILL_SPRING = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.9 };

type PillRect = { left: number; width: number };

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
  const pillTransition = reduceMotion ? { duration: 0 } : PILL_SPRING;
  const trackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [pillRect, setPillRect] = useState<PillRect | null>(null);

  const measurePill = useCallback(() => {
    if (!value) return;
    const button = buttonRefs.current.get(value);
    const track = trackRef.current;
    if (!button || !track) return;
    setPillRect({ left: button.offsetLeft, width: button.offsetWidth });
  }, [value]);

  useLayoutEffect(() => {
    measurePill();
  }, [measurePill, connectedProviders]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measurePill());
    observer.observe(track);
    return () => observer.disconnect();
  }, [measurePill]);

  const showPill = value !== null && pillRect !== null;

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label={`${DOMAIN_LABEL[domain]} default account`}
      className={cn(
        'relative inline-flex shrink-0 self-start rounded-full border border-white/10 bg-zinc-950/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        saving && 'pointer-events-none opacity-55',
      )}
    >
      {pillRect ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 z-0 rounded-full border border-emerald-400/30 bg-gradient-to-b from-emerald-400/24 via-emerald-500/16 to-emerald-600/8 shadow-[0_0_18px_rgba(52,211,153,0.18)]"
          initial={false}
          animate={{
            left: pillRect.left,
            width: pillRect.width,
            opacity: showPill ? 1 : 0,
          }}
          transition={{
            left: pillTransition,
            width: pillTransition,
            opacity: { duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' },
          }}
        />
      ) : null}

      {connectedProviders.map(provider => {
        const selected = value === provider;
        const label = PROVIDER_LABEL[provider] ?? provider[0].toUpperCase() + provider.slice(1);

        return (
          <button
            key={provider}
            ref={node => {
              if (node) buttonRefs.current.set(provider, node);
              else buttonRefs.current.delete(provider);
            }}
            type="button"
            disabled={saving}
            aria-pressed={selected}
            onClick={() => onSelect(provider)}
            className={cn(
              'relative z-10 min-w-[5.5rem] rounded-full px-4 py-1.5 text-sm font-medium',
              'transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
              selected ? 'text-emerald-50 delay-0' : 'text-zinc-500 delay-100 hover:text-zinc-300',
            )}
          >
            {label}
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

  if (connectedProviders.length < 2) return null;

  const handleSelect = (provider: string) => {
    onChange(value === provider ? null : provider);
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
          {value
            ? `New ${domain} actions use ${PROVIDER_LABEL[value] ?? value}. Tap again to clear.`
            : `Choose where new ${domain} actions go, or leave unset.`}
        </p>
      </div>

      <SlidingPillTrack
        domain={domain}
        connectedProviders={connectedProviders}
        value={value}
        saving={saving}
        onSelect={handleSelect}
      />
    </motion.div>
  );
}
