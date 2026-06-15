import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link2 } from 'lucide-react';
import {
  IntegrationLogo,
  PROVIDER_LOGOS,
} from '@dadei/ui/components/settings/integrations/integrationIcons';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import {
  ACCOUNT_FEATURES,
  defaultWorkspaceToolId,
  INTEGRATION_CATEGORIES,
  INTEGRATION_TOOL_COUNT,
  toolsForCategory,
  WORKSPACE_PROVIDERS,
  type IntegrationCategory,
  type IntegrationTool,
  type WorkspaceProvider,
  type WorkspaceProviderId,
} from './integrationsData';

function ToolIcon({ tool, active, size = 'sm' }: { tool: IntegrationTool; active: boolean; size?: 'sm' | 'md' }) {
  const iconClass =
    size === 'md'
      ? active
        ? 'h-4 w-4 text-emerald-300/90'
        : 'h-4 w-4 text-zinc-400'
      : active
        ? 'h-3.5 w-3.5 text-emerald-300/90'
        : 'h-3.5 w-3.5 text-zinc-500';

  if (tool.logo) {
    return <IntegrationLogo def={tool.logo} active={active} iconClassName={iconClass} />;
  }

  if (tool.Icon) {
    if (size === 'md') {
      return (
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
            active
              ? 'border-emerald-500/25 bg-emerald-500/10'
              : 'border-white/10 bg-zinc-950/80',
          )}
        >
          <tool.Icon className={iconClass} aria-hidden />
        </div>
      );
    }

    return <tool.Icon className={cn('h-3.5 w-3.5 shrink-0', iconClass)} aria-hidden />;
  }

  return null;
}

function panelButtonClass(active: boolean) {
  return active
    ? 'border-emerald-200/55 bg-emerald-400/26'
    : 'border-white/10 bg-zinc-900/75 hover:border-emerald-200/30 hover:bg-zinc-800/75';
}

function categoryPillClass(active: boolean) {
  return active
    ? 'border-emerald-300/45 bg-emerald-400/18 text-emerald-100 shadow-[0_0_20px_-8px_rgba(16,185,129,0.65)]'
    : 'border-white/10 bg-white/5 text-zinc-300 hover:border-emerald-200/25 hover:bg-white/8';
}

function toolTileClass(active: boolean) {
  return active
    ? 'border-emerald-300/40 bg-emerald-400/12 shadow-[0_0_24px_-10px_rgba(16,185,129,0.55)]'
    : 'border-white/8 bg-zinc-900/50 hover:border-emerald-200/20 hover:bg-zinc-800/55';
}

function providerStatusLabel(provider: WorkspaceProvider) {
  if (provider.comingSoon) return 'Coming soon';
  if (provider.linkedEmail) return `Connected to ${provider.linkedEmail}`;
  return 'Connected';
}

const PANEL_CROSSFADE = { duration: 0.22 };
const STACK_STAGGER = 0.04;

function stackItemMotion(index: number, reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      transition: PANEL_CROSSFADE,
    };
  }

  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...PANEL_CROSSFADE, delay: index * STACK_STAGGER },
  };
}

function scopeItemMotion(index: number, reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1, x: 0 },
      transition: PANEL_CROSSFADE,
    };
  }

  return {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    transition: { ...PANEL_CROSSFADE, delay: index * STACK_STAGGER },
  };
}

function AccountsLinkingHero({
  workspaceProvider,
  onWorkspaceProviderChange,
}: {
  workspaceProvider: WorkspaceProviderId;
  onWorkspaceProviderChange: (id: WorkspaceProviderId) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-300/20 bg-linear-to-br from-zinc-950 via-zinc-900/95 to-emerald-950/25 p-5 sm:p-6 lg:mb-8">
      <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-violet-500/8 blur-3xl" />

      <div className="relative space-y-5">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-emerald-300/80 font-secondary">connected accounts</p>
          <h3 className="mt-2 text-xl leading-tight text-zinc-50 font-primary sm:text-2xl">
            one network. google, microsoft, and apple.
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 font-secondary">
            Sign in with any provider, link additional accounts in Settings, and choose defaults for mail,
            calendar, and contacts — even when the emails don&apos;t match.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] tracking-[0.16em] text-zinc-500 font-secondary">
            select a provider to preview tools
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {WORKSPACE_PROVIDERS.map(provider => {
              const selected = workspaceProvider === provider.id;
              const status = providerStatusLabel(provider);

              return (
                <button
                  key={provider.id}
                  type="button"
                  disabled={provider.comingSoon}
                  onClick={() => onWorkspaceProviderChange(provider.id)}
                  className={cn(
                    'relative overflow-hidden rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow] duration-300',
                    provider.comingSoon && 'cursor-default opacity-80',
                    selected
                      ? 'border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_28px_-12px_rgba(16,185,129,0.55)]'
                      : 'border-white/10 bg-zinc-950/55 hover:border-emerald-200/25 hover:bg-zinc-900/70',
                  )}
                >
                  {selected ? (
                    <motion.span
                      layoutId="landing-provider-ring"
                      className="pointer-events-none absolute inset-0 rounded-2xl border border-emerald-400/35"
                      transition={
                        reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }
                      }
                    />
                  ) : null}
                  <div className="relative flex items-center gap-2.5">
                    <IntegrationLogo
                      def={PROVIDER_LOGOS[provider.id]}
                      active={selected}
                      iconClassName={cn(
                        'h-4 w-4',
                        provider.id === 'google' ? undefined : selected ? 'text-emerald-200' : 'text-zinc-400',
                      )}
                    />
                    <span className="text-sm font-medium text-zinc-100 font-secondary">{provider.label}</span>
                  </div>
                  <p
                    className={cn(
                      'relative mt-2 truncate text-[11px] font-secondary',
                      provider.comingSoon
                        ? 'text-zinc-500'
                        : provider.linkedEmail
                          ? 'text-emerald-200/85'
                          : 'text-zinc-400',
                    )}
                    title={provider.linkedEmail ?? provider.networkEmail}
                  >
                    {status}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ACCOUNT_FEATURES.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              className="rounded-2xl border border-white/8 bg-zinc-950/45 p-3"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/10 text-emerald-200">
                <Link2 className="h-3.5 w-3.5" aria-hidden />
              </span>
              <p className="mt-2.5 text-sm text-zinc-100 font-secondary">{feature.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 font-secondary">{feature.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShowcasePanel({
  label,
  borderClass,
  clamped = false,
  scrollable = false,
  panelRef,
  scrollRef,
  children,
}: {
  label: string;
  borderClass: string;
  clamped?: boolean;
  scrollable?: boolean;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div
      ref={panelRef}
      className={cn(
        'box-border grid min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden rounded-2xl border p-3',
        borderClass,
        clamped && 'lg:h-[var(--showcase-panel-h)]',
      )}
    >
      <p className="text-[11px] tracking-[0.18em] text-zinc-400 font-secondary">{label}</p>
      <div
        ref={scrollRef}
        className={
          scrollable
            ? 'scrollbar-none min-h-0 overflow-y-auto overscroll-contain'
            : 'min-h-0 overflow-hidden'
        }
      >
        {children}
      </div>
    </div>
  );
}

function IntegrationsDesktopExplorer({
  workspaceProvider,
  onWorkspaceProviderChange,
}: {
  workspaceProvider: WorkspaceProviderId;
  onWorkspaceProviderChange: (id: WorkspaceProviderId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const familyPanelRef = useRef<HTMLDivElement>(null);
  const toolsScrollRef = useRef<HTMLDivElement>(null);
  const scopeScrollRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<IntegrationCategory['id']>('workspace');
  const [toolId, setToolId] = useState<string>(() => defaultWorkspaceToolId('google'));

  useLayoutEffect(() => {
    const family = familyPanelRef.current;
    if (!family) return;

    const measure = () => setPanelHeight(family.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(family);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const category =
    INTEGRATION_CATEGORIES.find(item => item.id === categoryId) ?? INTEGRATION_CATEGORIES[0];
  const visibleTools = toolsForCategory(category, workspaceProvider);
  const tool = visibleTools.find(item => item.id === toolId) ?? visibleTools[0];

  useLayoutEffect(() => {
    toolsScrollRef.current?.scrollTo({ top: 0 });
    scopeScrollRef.current?.scrollTo({ top: 0 });
  }, [categoryId, toolId, workspaceProvider]);

  useLayoutEffect(() => {
    if (!tool || visibleTools.some(item => item.id === toolId)) return;
    setToolId(visibleTools[0]?.id ?? defaultWorkspaceToolId(workspaceProvider));
  }, [tool, toolId, visibleTools, workspaceProvider]);

  const selectCategory = (nextCategoryId: IntegrationCategory['id']) => {
    setCategoryId(nextCategoryId);
    const nextCategory = INTEGRATION_CATEGORIES.find(item => item.id === nextCategoryId);
    if (!nextCategory) return;
    const nextTools = toolsForCategory(nextCategory, workspaceProvider);
    if (nextTools[0]) setToolId(nextTools[0].id);
  };

  const rowStyle =
    panelHeight != null
      ? ({ '--showcase-panel-h': `${panelHeight}px` } as CSSProperties)
      : undefined;

  return (
    <div className="relative rounded-4xl border border-emerald-300/20 bg-zinc-950/82 p-5 sm:p-8">
      <AccountsLinkingHero
        workspaceProvider={workspaceProvider}
        onWorkspaceProviderChange={id => {
          onWorkspaceProviderChange(id);
          if (category.workspace) {
            setToolId(defaultWorkspaceToolId(id));
          }
        }}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start" style={rowStyle}>
        <ShowcasePanel
          panelRef={familyPanelRef}
          label="integrations"
          borderClass="border-white/10 bg-zinc-900/65"
        >
          <div className="space-y-2">
            {INTEGRATION_CATEGORIES.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCategory(item.id)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2.5 text-left transition',
                  panelButtonClass(item.id === categoryId),
                )}
              >
                <span className="text-xs text-zinc-100 font-secondary">{item.label}</span>
                <p className="mt-1 text-[11px] text-zinc-300/90 font-secondary">{item.short}</p>
              </button>
            ))}
          </div>
        </ShowcasePanel>

        <ShowcasePanel
          label="tools"
          borderClass="border-emerald-200/25 bg-zinc-900/60"
          clamped
          scrollable
          scrollRef={toolsScrollRef}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${categoryId}-${workspaceProvider}`}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={PANEL_CROSSFADE}
              className={cn(category.workspace ? 'grid grid-cols-2 gap-2' : 'space-y-2')}
            >
              {visibleTools.map((item, index) => (
                <motion.button
                  key={item.id}
                  type="button"
                  {...stackItemMotion(index, reduceMotion)}
                  onClick={() => setToolId(item.id)}
                  className={cn(
                    'rounded-xl border px-2.5 py-2 text-left transition-[border-color,background-color]',
                    category.workspace ? 'min-h-[4.5rem]' : 'w-full px-3 py-2.5',
                    panelButtonClass(item.id === tool?.id),
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-2 text-xs text-zinc-100 font-secondary',
                      category.workspace && 'flex-col items-start gap-1.5',
                    )}
                  >
                    <ToolIcon tool={item} active={item.id === tool?.id} size={category.workspace ? 'md' : 'sm'} />
                    <span className={cn(category.workspace && 'leading-tight')}>{item.name}</span>
                  </span>
                  {!category.workspace ? (
                    <p className="mt-1 text-[11px] text-zinc-300/90 font-secondary">{item.short}</p>
                  ) : (
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-400 font-secondary">
                      {item.short}
                    </p>
                  )}
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>
        </ShowcasePanel>

        <ShowcasePanel
          label="scopes"
          borderClass="border-white/10 bg-zinc-900/65"
          clamped
          scrollable
          scrollRef={scopeScrollRef}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${categoryId}-${tool?.id}-${workspaceProvider}`}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={PANEL_CROSSFADE}
              className="space-y-2"
            >
              {tool?.scopes.map((scope, index) => (
                <motion.div
                  key={scope.label}
                  {...scopeItemMotion(index, reduceMotion)}
                  className="rounded-lg border border-emerald-200/25 bg-emerald-400/12 px-3 py-2.5"
                >
                  <p className="text-xs font-medium text-emerald-100 font-secondary">{scope.label}</p>
                  {scope.detail ? (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400 font-secondary">
                      {scope.detail}
                    </p>
                  ) : null}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </ShowcasePanel>
      </div>
    </div>
  );
}

function IntegrationsMobileExplorer({
  workspaceProvider,
  onWorkspaceProviderChange,
}: {
  workspaceProvider: WorkspaceProviderId;
  onWorkspaceProviderChange: (id: WorkspaceProviderId) => void;
}) {
  const [categoryId, setCategoryId] = useState<IntegrationCategory['id']>('workspace');
  const [toolId, setToolId] = useState<string>(() => defaultWorkspaceToolId('google'));

  const category =
    INTEGRATION_CATEGORIES.find(item => item.id === categoryId) ?? INTEGRATION_CATEGORIES[0];
  const visibleTools = toolsForCategory(category, workspaceProvider);
  const tool = visibleTools.find(item => item.id === toolId) ?? visibleTools[0];

  const selectCategory = (nextCategoryId: IntegrationCategory['id']) => {
    setCategoryId(nextCategoryId);
    const nextCategory = INTEGRATION_CATEGORIES.find(item => item.id === nextCategoryId);
    if (!nextCategory) return;
    const nextTools = toolsForCategory(nextCategory, workspaceProvider);
    if (nextTools[0]) setToolId(nextTools[0].id);
  };

  return (
    <div className="space-y-4">
      <AccountsLinkingHero
        workspaceProvider={workspaceProvider}
        onWorkspaceProviderChange={id => {
          onWorkspaceProviderChange(id);
          if (category.workspace) setToolId(defaultWorkspaceToolId(id));
        }}
      />

      <div className="glass-panel conic-border relative overflow-hidden rounded-2xl border border-emerald-300/18 bg-zinc-950/42 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-[10px] tracking-[0.18em] text-zinc-400 font-secondary">
            {INTEGRATION_TOOL_COUNT} capabilities · {INTEGRATION_CATEGORIES.length} integrations
          </p>
          <p className="text-[10px] text-zinc-500 font-secondary">{category.short}</p>
        </div>

        <div className="scrollbar-none -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {INTEGRATION_CATEGORIES.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectCategory(item.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-[11px] transition font-secondary',
                categoryPillClass(item.id === categoryId),
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {visibleTools.map(item => {
            const active = item.id === tool?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setToolId(item.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2 text-center transition',
                  toolTileClass(active),
                )}
              >
                <ToolIcon tool={item} active={active} size="md" />
                <span className="line-clamp-2 text-[10px] leading-tight text-zinc-100 font-secondary">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${categoryId}-${tool?.id}-${workspaceProvider}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.2 }}
            className="mt-3 rounded-xl border border-white/8 bg-zinc-900/45 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-zinc-100 font-secondary">{tool?.name}</p>
                <p className="mt-0.5 text-[10px] text-zinc-400 font-secondary">{tool?.short}</p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-200/90 font-secondary">
                {tool?.scopes.length ?? 0} scopes
              </span>
            </div>

            <div className="scrollbar-none -mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-0.5">
              {tool?.scopes.map(scope => (
                <span
                  key={scope.label}
                  className="shrink-0 rounded-full border border-emerald-200/20 bg-emerald-400/8 px-2 py-0.5 text-[10px] text-emerald-100/90 font-secondary"
                  title={scope.detail}
                >
                  {scope.label}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function IntegrationsShowcase() {
  const [workspaceProvider, setWorkspaceProvider] = useState<WorkspaceProviderId>('google');

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.5 }}
      className="mt-10"
    >
      <div className="lg:hidden">
        <IntegrationsMobileExplorer
          workspaceProvider={workspaceProvider}
          onWorkspaceProviderChange={setWorkspaceProvider}
        />
      </div>
      <div className="hidden lg:block">
        <IntegrationsDesktopExplorer
          workspaceProvider={workspaceProvider}
          onWorkspaceProviderChange={setWorkspaceProvider}
        />
      </div>
    </motion.div>
  );
}
