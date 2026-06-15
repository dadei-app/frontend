import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useAuthMeQuery, useNeedsTutorial } from '@dadei/ui/lib/platform/query/queryHooks';
import { Loading } from '@dadei/ui/components/Loading';
import { TutorialOverlayContent } from '@dadei/ui/components/tutorial/Overlay';
import {
  TutorialProvider,
  useTutorialContext,
  useTutorialEngaged,
  useTutorialSettingsTourActive,
} from '@dadei/ui/contexts/TutorialContext';
import { isSettingsTutorialStep } from '@dadei/ui/lib/onboarding/tutorial/constants';
import { CommandBubbleStackHost, useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import MicrophoneButton from '@dadei/ui/components/MicrophoneButton';
import { ServicePermissionsGate } from '@dadei/ui/components/permissions/ServicePermissionsGate';
import { BannerStackHost, ToastStackHost } from '@dadei/ui/contexts/NotificationContext';
import Header from '@dadei/ui/components/Header';
import InteractionPanel from '@dadei/ui/components/interaction-panel';
import MobileInteractionsSheet from '@dadei/ui/components/MobileInteractionsSheet';
import AssistantSettingsModal from '@dadei/ui/components/settings';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/runtime/assistantPaths';
import { useMobileAssistant } from '@dadei/ui/lib/platform/hooks/useMobileAssistant';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import { ENROLLMENT_TRANSCRIPT_OPENER } from '@dadei/ui/types/command.types';

const ASSISTANT_HINT_ROW =
  'flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-500 font-secondary';

const WAKE_PHONETIC = 'dah-dee';

function WakeWordHint() {
  return (
    <div className="text-center font-secondary">
      <p className="text-sm text-zinc-500">
        Say <span className="text-emerald-400/90">hey dadei</span>
      </p>
      <p className="mt-1 text-[0.6875rem] tracking-wide text-zinc-600">{WAKE_PHONETIC}</p>
    </div>
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
  const settingsTourActive = useTutorialSettingsTourActive();
  useLayoutEffect(() => {
    if (settingsTourActive && tutorial?.openSettingsForTutorial) {
      setSettingsOpen(true);
    }
  }, [settingsTourActive, tutorial?.openSettingsForTutorial, setSettingsOpen, tutorial]);

  useLayoutEffect(() => {
    if (!tutorial) return;
    if (settingsOpen === false) return;
    if (!isSettingsTutorialStep(tutorial.step.id)) {
      setSettingsOpen(false);
    }
  }, [tutorial?.step.id, settingsOpen, setSettingsOpen, tutorial]);

  return null;
}

function TutorialPersonsBridge({
  setIsPeoplePanelOpen,
}: {
  setIsPeoplePanelOpen: (open: boolean) => void;
}) {
  const tutorial = useTutorialContext();
  const tutorialEngaged = useTutorialEngaged();
  useLayoutEffect(() => {
    if (!tutorialEngaged || !tutorial) {
      setIsPeoplePanelOpen(false);
      return;
    }
    if (tutorial.step.openPersonsPanel || tutorial.step.id === 'delete_person') {
      setIsPeoplePanelOpen(true);
    }
  }, [
    tutorialEngaged,
    tutorial?.step.openPersonsPanel,
    tutorial?.step.id,
    setIsPeoplePanelOpen,
    tutorial,
  ]);
  return null;
}

function assistantLoadingSubtitle(
  isBootstrapReady: boolean,
  isLoading: boolean,
  isLoggingOut: boolean,
  meLoading: boolean,
  sessionDataLoading: boolean,
  isConnected: boolean,
): string | undefined {
  if (isLoggingOut) return 'Signing out…';
  if (isBootstrapReady && isLoading) return 'Signing in…';
  if (isBootstrapReady && meLoading) return 'Loading your profile…';
  if (isBootstrapReady && sessionDataLoading) {
    return isConnected ? 'Loading your data…' : 'Connecting…';
  }
  return undefined;
}

function AssistantLayoutShell() {
  const { formatHotkey, viewportFillClass } = useSystem();
  const isMobileAssistant = useMobileAssistant();
  const { isServiceEnabled, permissionsGateOpen } = useService();
  const { state, voiceEnrollmentActive } = useCommand();
  const tutorial = useTutorialContext();
  const tutorialEngaged = useTutorialEngaged();
  const needsTutorial = useNeedsTutorial();
  const elevateNotifications = tutorialEngaged && tutorial?.step.id === 'layout_tour';
  const showTalkHint = voiceEnrollmentActive;
  const showWakeHint =
    state === 'idle' &&
    isServiceEnabled &&
    !permissionsGateOpen &&
    !voiceEnrollmentActive &&
    (!tutorial || tutorial.wakeWordEnabled);
  const [isPeoplePanelOpen, setIsPeoplePanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  return (
    <div
      data-tutorial-target="assistant-layout-shell"
      className={cn(
        'assistant-shell relative flex flex-col overflow-hidden overscroll-none bg-zinc-950 text-zinc-100',
        viewportFillClass,
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
      <div className="pointer-events-none absolute inset-0 assistant-shell-atmosphere" aria-hidden />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Header
          isPeoplePanelOpen={isPeoplePanelOpen}
          setIsPeoplePanelOpen={setIsPeoplePanelOpen}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="assistant-shell-main relative z-0 flex min-h-0 flex-1 min-w-0 overscroll-none">
          <div className="assistant-shell-mic-pane relative flex min-h-0 min-w-0 flex-1 flex-col overflow-visible px-4 pt-4 pb-6 sm:px-6 lg:px-10 lg:pt-6 lg:pb-10">
            <div
              className={cn(
                'pointer-events-none absolute top-4 left-4 w-[calc(100%-2rem)] sm:left-6 sm:w-[calc(100%-3rem)] lg:left-10 lg:w-[calc(100%-5rem)]',
                elevateNotifications ? 'z-[10002]' : 'z-30',
              )}
            >
              <BannerStackHost />
            </div>
            <ServicePermissionsGate />
            <div className="relative min-h-0 flex-1 overflow-visible">
              {/* Mic: geometric center of the left panel; hints are out of flow. */}
              <AnimatePresence initial={false}>
                {showWakeHint ? (
                  <motion.div
                    key="wake-hint"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: permissionsGateOpen ? 0 : 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2 }}
                    className="assistant-wake-hint-slot"
                  >
                    <WakeWordHint />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div
                className={cn(
                  'pointer-events-none absolute z-10 flex items-center justify-center',
                  isMobileAssistant ? 'assistant-mic-anchor inset-x-0' : 'inset-0',
                )}
              >
                <div className="pointer-events-auto isolate">
                  <MicrophoneButton
                    disableSpaceToggle={isPeoplePanelOpen || isMobileAssistant || permissionsGateOpen}
                  />
                </div>
              </div>

              {/* Bottom hints: overlay only — never participate in flex layout. */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: permissionsGateOpen ? 0 : 1 }}
                className="assistant-hint-row pointer-events-none absolute inset-x-0 bottom-0 z-10 flex select-none flex-col items-center gap-2.5 px-2 pt-3 pb-8 text-sm text-zinc-500 font-secondary lg:pb-8"
              >
                <AnimatePresence initial={false}>
                  {showTalkHint ? (
                    <motion.p
                      key="talk-hint"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2 }}
                      className={ASSISTANT_HINT_ROW}
                    >
                      <span>{ENROLLMENT_TRANSCRIPT_OPENER}</span>
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                <p className={cn(ASSISTANT_HINT_ROW, 'assistant-hint-kbd-row')}>
                  <kbd className="assistant-hint-kbd rounded-md border border-white/10 bg-zinc-900/80 px-4 py-1 font-mono text-base text-zinc-300 shadow-inner shadow-black/40">
                    {formatHotkey()}
                  </kbd>
                  <span>to toggle</span>
                </p>
              </motion.div>

              <CommandBubbleStackHost />
            </div>
          </div>

          {!isMobileAssistant ? (
            <div className="assistant-shell-interactions atmosphere-grain flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-white/7 bg-zinc-950/78">
              <InteractionPanel />
            </div>
          ) : null}
        </main>

        {isMobileAssistant ? (
          <MobileInteractionsSheet>
            <InteractionPanel embedded />
          </MobileInteractionsSheet>
        ) : null}
      </div>

      {needsTutorial ? (
        <>
          <TutorialSettingsBridge settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
          <TutorialPersonsBridge setIsPeoplePanelOpen={setIsPeoplePanelOpen} />
        </>
      ) : null}
      <AssistantSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      {/* Above settings overlay (z-[250]); must not live inside the z-10 main stacking context. */}
      <ToastStackHost
        className={cn(
          'assistant-toast-host fixed right-5 bottom-5',
          elevateNotifications ? 'z-[10002]' : 'z-[260]',
        )}
      />
    </div>
  );
}

export default function AssistantLayout() {
  const { isAuthenticated, isLoading, isLoggingOut } = useAuth();
  const { isBootstrapReady } = useSystem();
  const { isConnected, isReady } = useService();
  const meQuery = useAuthMeQuery(isAuthenticated && isBootstrapReady && !isLoading);
  const needsTutorial = useNeedsTutorial();
  const location = useLocation();
  const meLoading = isAuthenticated && meQuery.isLoading;
  const sessionDataLoading = isAuthenticated && !isReady;
  const showLoadingOverlay =
    isLoggingOut ||
    !isBootstrapReady ||
    isLoading ||
    meLoading ||
    sessionDataLoading;
  const showShell =
    isBootstrapReady && !isLoading && !isLoggingOut && isAuthenticated && isReady;

  if (isBootstrapReady && !isLoading && !isLoggingOut && !isAuthenticated) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const qs = next && next !== ASSISTANT_PATH ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${qs}`} replace />;
  }

  return (
    <>
      {showShell ? (
        needsTutorial ? (
          <TutorialProvider>
            <AssistantLayoutShell />
            <TutorialOverlayContent />
          </TutorialProvider>
        ) : (
          <AssistantLayoutShell />
        )
      ) : null}
      <Loading
        visible={showLoadingOverlay}
        subtitleOverride={assistantLoadingSubtitle(
          isBootstrapReady,
          isLoading,
          isLoggingOut,
          meLoading,
          sessionDataLoading,
          isConnected,
        )}
      />
    </>
  );
}
