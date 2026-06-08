import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useAuthMeQuery } from '@dadei/ui/lib/query/queryHooks';
import { LoadingScreen } from '@dadei/ui/components/LoadingScreen';
import { TutorialOverlayContent, TutorialProvider } from '@dadei/ui/components/tutorial';
import { useTutorialContext } from '@dadei/ui/components/tutorial/TutorialContext';
import { CommandBubbleStackHost, useCommand } from '@dadei/ui/contexts/CommandContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import MicrophoneButton from '@dadei/ui/components/MicrophoneButton';
import { BannerStackHost, ToastStackHost } from '@dadei/ui/contexts/NotificationContext';
import Header from '@dadei/ui/components/Header';
import InteractionPanel from '@dadei/ui/components/interaction-panel';
import AssistantSettingsModal from '@dadei/ui/components/settings';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/assistantPaths';
import { viewportFillClass } from '@dadei/ui/lib/platform/electronWindowChrome';
import { cn } from '@dadei/ui/lib/shared/cn';
import { Mic } from 'lucide-react';

const ASSISTANT_HINT_ROW =
  'flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-500 font-secondary';

function SpokenWakeWord({
  children,
  variant,
}: {
  children: string;
  variant: 'dadei' | 'assistant';
}) {
  const quoteClass =
    variant === 'dadei' ? 'text-emerald-400/55' : 'text-sky-400/55';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border px-2.5 py-1 font-primary text-[15px] font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        variant === 'dadei'
          ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50'
          : 'border-sky-400/25 bg-sky-500/10 text-sky-50',
      )}
    >
      <span className={cn('select-none text-[13px] font-normal leading-none', quoteClass)} aria-hidden>
        {'\u201c'}
      </span>
      {children}
      <span className={cn('select-none text-[13px] font-normal leading-none', quoteClass)} aria-hidden>
        {'\u201d'}
      </span>
    </span>
  );
}

/**
 * Authenticated assistant shell: layout, theme tokens, overlays (settings), and realtime hooks.
 */
function TutorialSettingsBridge({
  settingsOpen,
  setSettingsOpen,
}: {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}) {
  const tutorial = useTutorialContext();
  useLayoutEffect(() => {
    if (tutorial?.openSettingsForTutorial) {
      setSettingsOpen(true);
    }
  }, [tutorial?.openSettingsForTutorial, setSettingsOpen]);
  return null;
}

function TutorialPersonsBridge({
  setIsPeoplePanelOpen,
}: {
  setIsPeoplePanelOpen: (open: boolean) => void;
}) {
  const tutorial = useTutorialContext();
  useLayoutEffect(() => {
    if (tutorial?.step.openPersonsPanel) {
      setIsPeoplePanelOpen(true);
    }
  }, [tutorial?.step.openPersonsPanel, tutorial?.step.id, setIsPeoplePanelOpen]);
  return null;
}

function AssistantLayoutShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isBootstrapReady, formatHotkey } = useSystem();
  const { isConnected, isServiceEnabled } = useService();
  const { state } = useCommand();
  const tutorial = useTutorialContext();
  const elevateNotifications = tutorial?.step.id === 'layout_tour';
  const showWakeHint =
    state === 'idle' && isServiceEnabled && (!tutorial || tutorial.wakeWordEnabled);
  const [isPeoplePanelOpen, setIsPeoplePanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--assistant-header-h', '4.75rem');
    root.style.setProperty('--assistant-mic-h', '10rem');
    root.style.setProperty('--assistant-mic-half', '5rem');
    root.style.setProperty('--assistant-dock-gap', '0.75rem');
    /** Reserved strip at panel bottom for hint overlays (does not affect mic centering). */
    root.style.setProperty('--assistant-hints-reserve', '4.75rem');
    return () => {
      root.style.removeProperty('--assistant-header-h');
      root.style.removeProperty('--assistant-mic-h');
      root.style.removeProperty('--assistant-mic-half');
      root.style.removeProperty('--assistant-dock-gap');
      root.style.removeProperty('--assistant-hints-reserve');
    };
  }, []);

  if (!isBootstrapReady || isLoading) {
    return (
      <LoadingScreen
        subtitleOverride={isBootstrapReady && isLoading ? 'Signing in…' : undefined}
      />
    );
  }

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const qs = next && next !== ASSISTANT_PATH ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${qs}`} replace />;
  }

  return (
    <div
      data-tutorial-target="assistant-layout-shell"
      className={cn(
        'assistant-shell relative flex flex-col overflow-hidden overscroll-none bg-zinc-950 text-zinc-100',
        viewportFillClass(),
      )}
      style={
        {
          ['--assistant-accent' as string]: 'rgb(52 211 153)',
          ['--assistant-accent-muted' as string]: 'rgb(6 95 70)',
          ['--assistant-surface' as string]: 'rgba(24 24 27 / 0.72)',
          ['--assistant-border' as string]: 'rgba(255, 255, 255, 0.08)',
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(circle at 100% 20%, rgba(6,182,212,0.08), transparent 45%), linear-gradient(180deg, rgba(9,9,11,0.97) 0%, rgba(24,24,27,0.99) 100%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Header
          isPeoplePanelOpen={isPeoplePanelOpen}
          setIsPeoplePanelOpen={setIsPeoplePanelOpen}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="relative z-0 flex min-h-0 flex-1 min-w-0 overscroll-none">
          <div
            className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-visible px-10 pt-6 pb-10"
            style={{
              background:
                'linear-gradient(145deg, rgba(24,24,27,0.35) 0%, rgba(9,9,11,0.55) 100%)',
            }}
          >
            <div
              className={cn(
                'pointer-events-none absolute top-4 left-10 w-[calc(100%-5rem)]',
                elevateNotifications ? 'z-[10002]' : 'z-30',
              )}
            >
              <BannerStackHost />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {/* Mic: geometric center of the left panel; hints are out of flow. */}
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="pointer-events-auto isolate">
                  <MicrophoneButton disableSpaceToggle={isPeoplePanelOpen} />
                </div>
              </div>

              {/* Hints: overlay only — never participate in flex layout. */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex select-none flex-col items-center gap-2.5 px-2 pb-8 pt-3 text-sm text-zinc-500 font-secondary"
              >
                <AnimatePresence initial={false}>
                  {showWakeHint ? (
                    <motion.p
                      key="wake-hint"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2 }}
                      className={ASSISTANT_HINT_ROW}
                    >
                      <span>Say</span>
                      <SpokenWakeWord variant="dadei">Dadei</SpokenWakeWord>
                      <span>or</span>
                      <SpokenWakeWord variant="assistant">Assistant</SpokenWakeWord>
                      <span>to start a command</span>
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                <p className={ASSISTANT_HINT_ROW}>
                  <kbd className="rounded-md border border-white/10 bg-zinc-900/80 px-4 py-1 font-mono text-base text-zinc-300 shadow-inner shadow-black/40">
                    {formatHotkey()}
                  </kbd>
                  <span>to toggle</span>
                </p>
              </motion.div>

              <CommandBubbleStackHost />
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-white/7 bg-zinc-950/40 backdrop-blur-sm">
            <InteractionPanel />
          </div>
        </main>
      </div>

      <TutorialSettingsBridge settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
      <TutorialPersonsBridge setIsPeoplePanelOpen={setIsPeoplePanelOpen} />
      <AssistantSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      {/* Above settings overlay (z-[250]); must not live inside the z-10 main stacking context. */}
      <ToastStackHost
        className={cn('fixed right-5 bottom-5', elevateNotifications ? 'z-[10002]' : 'z-[260]')}
      />
    </div>
  );
}

export default function AssistantLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isBootstrapReady } = useSystem();
  const meQuery = useAuthMeQuery(isAuthenticated && isBootstrapReady && !isLoading);
  const needsTutorial = Boolean(meQuery.data && !meQuery.data.tutorial_completed);

  if (!isBootstrapReady || isLoading || (isAuthenticated && meQuery.isLoading)) {
    return (
      <LoadingScreen
        subtitleOverride={isBootstrapReady && isLoading ? 'Signing in…' : undefined}
      />
    );
  }

  if (needsTutorial) {
    return (
      <TutorialProvider>
        <AssistantLayoutShell />
        <TutorialOverlayContent />
      </TutorialProvider>
    );
  }

  return <AssistantLayoutShell />;
}
