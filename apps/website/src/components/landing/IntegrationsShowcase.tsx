import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IntegrationLogo } from '@dadei/ui/components/settings/integrations/integrationIcons';
import {
  INTEGRATION_CATEGORIES,
  type IntegrationCategory,
  type IntegrationTool,
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
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            active
              ? 'border-emerald-500/25 bg-emerald-500/10'
              : 'border-white/10 bg-zinc-950/80'
          }`}
        >
          <tool.Icon className={iconClass} aria-hidden />
        </div>
      );
    }

    return <tool.Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} aria-hidden />;
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
      className={`box-border grid min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden rounded-2xl border p-3 ${borderClass} ${
        clamped ? 'lg:h-[var(--showcase-panel-h)]' : ''
      }`}
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

function IntegrationsDesktopExplorer() {
  const familyPanelRef = useRef<HTMLDivElement>(null);
  const toolsScrollRef = useRef<HTMLDivElement>(null);
  const scopeScrollRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<IntegrationCategory['id']>('google');
  const [toolId, setToolId] = useState<string>('gmail');

  useLayoutEffect(() => {
    const family = familyPanelRef.current;
    if (!family) return;

    const measure = () => {
      setPanelHeight(family.offsetHeight);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(family);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useLayoutEffect(() => {
    toolsScrollRef.current?.scrollTo({ top: 0 });
    scopeScrollRef.current?.scrollTo({ top: 0 });
  }, [categoryId, toolId]);

  const category =
    INTEGRATION_CATEGORIES.find((item) => item.id === categoryId) ?? INTEGRATION_CATEGORIES[0];
  const tool = category.tools.find((item) => item.id === toolId) ?? category.tools[0];

  const selectCategory = (nextCategoryId: IntegrationCategory['id']) => {
    setCategoryId(nextCategoryId);
    const nextCategory = INTEGRATION_CATEGORIES.find((item) => item.id === nextCategoryId);
    if (nextCategory?.tools[0]) {
      setToolId(nextCategory.tools[0].id);
    }
  };

  const rowStyle =
    panelHeight != null
      ? ({ '--showcase-panel-h': `${panelHeight}px` } as CSSProperties)
      : undefined;

  return (
    <div className="relative mt-10 rounded-4xl border border-emerald-300/20 bg-zinc-950/82 p-5 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start" style={rowStyle}>
        <ShowcasePanel
          panelRef={familyPanelRef}
          label="data family"
          borderClass="border-white/10 bg-zinc-900/65"
        >
          <div className="space-y-2">
            {INTEGRATION_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCategory(item.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${panelButtonClass(item.id === categoryId)}`}
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
          <div className="space-y-2">
            {category.tools.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setToolId(item.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${panelButtonClass(item.id === tool.id)}`}
              >
                <span className="inline-flex items-center gap-2 text-xs text-zinc-100 font-secondary">
                  <ToolIcon tool={item} active={item.id === tool.id} />
                  {item.name}
                </span>
                <p className="mt-1 text-[11px] text-zinc-300/90 font-secondary">{item.short}</p>
              </button>
            ))}
          </div>
        </ShowcasePanel>

        <ShowcasePanel
          label="scope"
          borderClass="border-white/10 bg-zinc-900/65"
          clamped
          scrollable
          scrollRef={scopeScrollRef}
        >
          <div className="space-y-2">
            {tool.scopes.map((scope, i) => (
              <motion.div
                key={scope.label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: i * 0.04 }}
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
          </div>
        </ShowcasePanel>
      </div>
    </div>
  );
}

function IntegrationsMobileExplorer() {
  const [categoryId, setCategoryId] = useState<IntegrationCategory['id']>('google');
  const [toolId, setToolId] = useState<string>('gmail');

  const category =
    INTEGRATION_CATEGORIES.find((item) => item.id === categoryId) ?? INTEGRATION_CATEGORIES[0];
  const tool = category.tools.find((item) => item.id === toolId) ?? category.tools[0];

  const selectCategory = (nextCategoryId: IntegrationCategory['id']) => {
    setCategoryId(nextCategoryId);
    const nextCategory = INTEGRATION_CATEGORIES.find((item) => item.id === nextCategoryId);
    if (nextCategory?.tools[0]) {
      setToolId(nextCategory.tools[0].id);
    }
  };

  const totalTools = INTEGRATION_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <div className="glass-panel conic-border relative mt-6 overflow-hidden rounded-2xl border border-emerald-300/18 bg-zinc-950/42 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-[10px] tracking-[0.18em] text-zinc-400 font-secondary">
          {totalTools} integrations · {INTEGRATION_CATEGORIES.length} families
        </p>
        <p className="text-[10px] text-zinc-500 font-secondary">{category.short}</p>
      </div>

      <div className="scrollbar-none -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {INTEGRATION_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectCategory(item.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] transition font-secondary ${categoryPillClass(item.id === categoryId)}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {category.tools.map((item) => {
          const active = item.id === tool.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setToolId(item.id)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2 text-center transition ${toolTileClass(active)}`}
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
          key={`${categoryId}-${toolId}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.2 }}
          className="mt-3 rounded-xl border border-white/8 bg-zinc-900/45 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-zinc-100 font-secondary">{tool.name}</p>
              <p className="mt-0.5 text-[10px] text-zinc-400 font-secondary">{tool.short}</p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-200/90 font-secondary">
              {tool.scopes.length} scopes
            </span>
          </div>

          <div className="scrollbar-none -mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-0.5">
            {tool.scopes.map((scope) => (
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
  );
}

export default function IntegrationsShowcase() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="lg:hidden">
        <IntegrationsMobileExplorer />
      </div>
      <div className="hidden lg:block">
        <IntegrationsDesktopExplorer />
      </div>
    </motion.div>
  );
}
