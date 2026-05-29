import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import CommandBubble from '@dadei/ui/components/CommandBubble';
import MicrophoneButton from '@dadei/ui/components/MicrophoneButton';
import { BannerStackHost, ToastStackHost } from '@dadei/ui/contexts/NotificationContext';
import Header from '@dadei/ui/components/Header';
import InteractionPanel from '@dadei/ui/components/interaction-panel';
import AssistantSettingsModal from '@dadei/ui/components/modals/SettingsModal';
import { DesktopTitleBarStrip } from '@dadei/ui/components/DesktopWindowChrome';
import { useMemoriesQuery, useActionsQuery } from '@dadei/ui/lib/queryHooks';
import { DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS, isElectronDesktop } from '@dadei/ui/lib/electronWindowChrome';
import { ASSISTANT_PATH } from '@dadei/ui/lib/assistantPaths';
import { Mic } from 'lucide-react';

/**
 * Authenticated assistant shell: layout, theme tokens, overlays (settings), and realtime hooks.
 */
export default function AssistantLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isConnected, isServiceEnabled } = useService();
  const { state } = useCommand();
  const showWakeHint = state === 'idle' && isServiceEnabled;
  const [isPeoplePanelOpen, setIsPeoplePanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();

  const sessionDataEnabled = isAuthenticated && !isLoading && isConnected;
  const actionBannerEnabled = isAuthenticated && !isLoading;
  useMemoriesQuery(sessionDataEnabled);
  useActionsQuery(actionBannerEnabled);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      '--assistant-titlebar-offset',
      isElectronDesktop() ? DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS : '0px',
    );
    root.style.setProperty('--assistant-header-h', '4.75rem');
    return () => {
      root.style.removeProperty('--assistant-titlebar-offset');
      root.style.removeProperty('--assistant-header-h');
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col overscroll-none bg-zinc-950">
        {isElectronDesktop() ? <DesktopTitleBarStrip /> : null}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.25), transparent), radial-gradient(circle at 100% 0%, rgba(6,182,212,0.12), transparent 50%)',
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-4">
            <Mic className="h-16 w-16 animate-pulse text-emerald-400/90" strokeWidth={1.5} />
            <p className="text-lg font-medium tracking-tight text-zinc-300">
              <span className="font-secondary">Loading dadei…</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const qs = next && next !== ASSISTANT_PATH ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${qs}`} replace />;
  }

  return (
    <div
      className="assistant-shell relative flex h-screen flex-col overflow-hidden overscroll-none bg-zinc-950 text-zinc-100"
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
        {isElectronDesktop() ? <DesktopTitleBarStrip /> : null}
        <Header
          isPeoplePanelOpen={isPeoplePanelOpen}
          setIsPeoplePanelOpen={setIsPeoplePanelOpen}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="relative z-0 flex min-h-0 flex-1 overflow-hidden overscroll-none">
          <div
            className="relative flex min-h-0 flex-1 flex-col px-10 pt-6 pb-10"
            style={{
              background:
                'linear-gradient(145deg, rgba(24,24,27,0.35) 0%, rgba(9,9,11,0.55) 100%)',
            }}
          >
            <div className="pointer-events-none absolute top-4 left-10 z-30 w-[calc(100%-5rem)]">
              <BannerStackHost />
            </div>
            <ToastStackHost className="fixed right-5 bottom-5 z-180" />
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              <div className="relative z-10 flex flex-col items-center">
                <div className="pointer-events-none absolute bottom-[calc(100%+1.25rem)] left-1/2 z-20 w-[min(640px,calc(100vw-8rem))] -translate-x-1/2">
                  <div className="flex w-full flex-col items-center gap-3">
                    <AnimatePresence>
                      {state !== 'idle' && state !== 'locked' ? (
                        <motion.div
                          key="command-live-bubble"
                          layout
                          initial={{ opacity: 0, y: 30, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -18, scale: 0.96 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="pointer-events-none flex w-full justify-center"
                        >
                          <CommandBubble />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
                <MicrophoneButton disableSpaceToggle={isPeoplePanelOpen} />
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex select-none flex-col items-center gap-2.5 text-sm text-zinc-500 font-secondary"
            >
              <AnimatePresence>
                {showWakeHint ? (
                  <motion.div
                    key="wake-hint"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-wrap items-center justify-center gap-2"
                  >
                    <span>Say</span>
                    <kbd className="rounded-md border border-white/10 bg-zinc-900/80 px-3 py-1 font-mono text-base text-zinc-300 shadow-inner shadow-black/40">
                      Dadei
                    </kbd>
                    <span>or</span>
                    <kbd className="rounded-md border border-white/10 bg-zinc-900/80 px-3 py-1 font-mono text-base text-zinc-300 shadow-inner shadow-black/40">
                      Assistant
                    </kbd>
                    <span>to start a command</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <div className="flex items-center gap-2">
                <kbd className="rounded-md border border-white/10 bg-zinc-900/80 px-4 py-1 font-mono text-base text-zinc-300 shadow-inner shadow-black/40">
                  Space
                </kbd>
                <span>to toggle</span>
              </div>
            </motion.div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col border-l border-white/7 bg-zinc-950/40 backdrop-blur-sm">
            <InteractionPanel />
          </div>
        </main>
      </div>

      <AssistantSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
