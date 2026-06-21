import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

const PILL_SPRING = { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.9 };

type PillRect = { left: number; width: number };

function pillCornerClass(index: number, total: number): string {
  if (total <= 1) return 'rounded-full';
  if (index === 0) return 'rounded-l-full rounded-r-none';
  if (index === total - 1) return 'rounded-r-full rounded-l-none';
  return 'rounded-none';
}

function readPillRect(
  value: string,
  buttonRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>,
): PillRect | null {
  const button = buttonRefs.current.get(value);
  if (!button) return null;
  return { left: button.offsetLeft, width: button.offsetWidth };
}

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
  const trackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastPillRectRef = useRef<PillRect | null>(null);
  const lastCornerIndexRef = useRef(0);
  const prevValueRef = useRef<string | null>(value);
  const isFirstLayoutRef = useRef(true);
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const [cornerIndex, setCornerIndex] = useState(0);

  const selectedIndex =
    value !== null ? connectedProviders.indexOf(value) : lastCornerIndexRef.current;

  const syncCornerIndex = useCallback(
    (index: number) => {
      if (index < 0) return;
      setCornerIndex(index);
      lastCornerIndexRef.current = index;
    },
    [],
  );

  const measure = useCallback(() => {
    if (!value) return;
    const next = readPillRect(value, buttonRefs);
    if (next) lastPillRectRef.current = next;
    setLayoutEpoch(epoch => epoch + 1);
  }, [value]);

  useLayoutEffect(() => {
    const selectionChanged = prevValueRef.current !== value;
    prevValueRef.current = value;
    measure();

    const index = value !== null ? connectedProviders.indexOf(value) : -1;
    if (isFirstLayoutRef.current || !selectionChanged || reduceMotion) {
      syncCornerIndex(index);
      isFirstLayoutRef.current = false;
    }
  }, [connectedProviders, measure, reduceMotion, syncCornerIndex, value]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  const pillTarget = useMemo(() => {
    if (!value) return lastPillRectRef.current;
    return readPillRect(value, buttonRefs) ?? lastPillRectRef.current;
  }, [layoutEpoch, value]);
  const pillVisible = value !== null && pillTarget !== null;

  const handlePillAnimationComplete = () => {
    if (selectedIndex < 0) return;
    syncCornerIndex(selectedIndex);
  };

  const motionTransition = reduceMotion
    ? { duration: 0 }
    : {
        x: PILL_SPRING,
        width: { duration: 0 },
        opacity: { duration: 0.18, ease: 'easeOut' as const },
      };

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label={`${DOMAIN_LABEL[domain]} default account`}
      className={cn(
        'relative inline-flex shrink-0 items-stretch self-start rounded-full border border-white/10 bg-zinc-950/70 p-1',
        saving && 'pointer-events-none',
      )}
    >
      {pillTarget ? (
        <motion.div
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1 bottom-1 left-0 z-0 border border-emerald-400/35 bg-emerald-500/10 shadow-[0_0_28px_-12px_rgba(16,185,129,0.55)] will-change-[transform,width,opacity]',
            pillCornerClass(
              cornerIndex >= 0 ? cornerIndex : lastCornerIndexRef.current,
              connectedProviders.length,
            ),
          )}
          initial={false}
          animate={{
            x: pillTarget.left,
            width: pillTarget.width,
            opacity: pillVisible ? 1 : 0,
          }}
          transition={motionTransition}
          onAnimationComplete={handlePillAnimationComplete}
        />
      ) : null}

      {connectedProviders.map((provider, index) => {
        const selected = value === provider;
        const label = PROVIDER_LABEL[provider] ?? provider[0].toUpperCase() + provider.slice(1);

        return (
          <Fragment key={provider}>
            {index > 0 ? (
              <span
                aria-hidden
                className="pointer-events-none relative z-20 my-1 w-px shrink-0 self-stretch bg-white/10"
              />
            ) : null}
            <button
              ref={node => {
                if (node) buttonRefs.current.set(provider, node);
                else buttonRefs.current.delete(provider);
              }}
              type="button"
              disabled={saving}
              aria-pressed={selected}
              onClick={() => onSelect(provider)}
              className={cn(
                'relative z-10 min-w-[5.5rem] px-4 py-1.5 text-sm font-medium',
                'transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                selected ? 'text-emerald-100' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {label}
            </button>
          </Fragment>
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

  const hint = localValue
    ? `New ${domain} actions use ${PROVIDER_LABEL[localValue] ?? localValue}. Tap again to clear.`
    : `Choose where new ${domain} actions go, or leave unset.`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/35 px-3.5 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-primary text-sm text-zinc-100">{DOMAIN_LABEL[domain]} — default account</p>
        <p className="mt-0.5 font-secondary text-xs text-zinc-500">{hint}</p>
      </div>

      <SlidingPillTrack
        domain={domain}
        connectedProviders={connectedProviders}
        value={localValue}
        saving={saving}
        onSelect={handleSelect}
      />
    </div>
  );
}
