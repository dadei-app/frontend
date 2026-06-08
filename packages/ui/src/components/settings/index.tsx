import { useEffect, useState, type ComponentType } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Brain,
  Info,
  Mic,
  Plug,
  Power,
  Sparkles,
  UserCircle2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AmbientShader } from '@dadei/ui/components/theme/AmbientShader';
import { AboutPanel } from './about/AboutPanel';
import { AccountPanel } from './account/AccountPanel';
import { AudioPanel } from './audio/AudioPanel';
import { IntegrationsPanel } from './integrations/IntegrationsPanel';
import { MemoriesPanel } from './memories/MemoriesPanel';
import { StartupPanel } from './startup/StartupPanel';
import { SubscriptionPanel } from './subscription/SubscriptionPanel';
import type { SettingsPanelProps } from './layout';
import { cn } from '@dadei/ui/lib/shared/cn';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';
import { useTutorialContext } from '@dadei/ui/components/tutorial/TutorialContext';
import { veilEase } from '@dadei/ui/lib/shared/motion';

type AssistantSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type SidebarView =
  | 'integrations'
  | 'memories'
  | 'account'
  | 'audio'
  | 'startup'
  | 'subscription'
  | 'about';

const ALL_VIEWS: { id: SidebarView; label: string; Icon: LucideIcon }[] = [
  { id: 'integrations', label: 'Integrations', Icon: Plug },
  { id: 'memories', label: 'Memories', Icon: Brain },
  { id: 'account', label: 'Account', Icon: UserCircle2 },
  { id: 'audio', label: 'Audio', Icon: Mic },
  { id: 'startup', label: 'Startup', Icon: Power },
  { id: 'subscription', label: 'Subscription', Icon: Sparkles },
  { id: 'about', label: 'About', Icon: Info },
];

function visibleViews() {
  const desktop = isElectronDesktop();
  return ALL_VIEWS.filter(v => {
    if (v.id === 'startup' && !desktop) return false;
    if (v.id === 'about' && !desktop) return false;
    return true;
  });
}

const PANELS: Record<SidebarView, ComponentType<SettingsPanelProps>> = {
  integrations: IntegrationsPanel,
  memories: MemoriesPanel,
  account: AccountPanel,
  audio: AudioPanel,
  startup: StartupPanel,
  subscription: SubscriptionPanel,
  about: AboutPanel,
};

function dialogOverlayClass(isElectron: boolean) {
  return cn(
    'fixed inset-0 z-[240] bg-zinc-950/65 backdrop-blur-md',
    isElectron && 'top-[var(--assistant-titlebar-offset,2rem)]',
  );
}

const dialogContentClass =
  'fixed left-1/2 z-[250] flex w-[min(calc(100%-1.5rem),80rem)] max-w-[80rem] -translate-x-1/2 -translate-y-1/2 border-0 bg-transparent p-0 shadow-none outline-none focus:outline-none top-[calc(50%+var(--assistant-titlebar-offset,2rem)/2)]';

const dialogContentClassWeb =
  'fixed left-1/2 top-1/2 z-[250] flex w-[min(calc(100%-1.5rem),80rem)] max-w-[80rem] -translate-x-1/2 -translate-y-1/2 border-0 bg-transparent p-0 shadow-none outline-none focus:outline-none';

export default function AssistantSettingsModal({ open, onOpenChange }: AssistantSettingsModalProps) {
  const [view, setView] = useState<SidebarView>('integrations');
  const [pendingAction, setPendingAction] = useState<string | undefined>(undefined);
  const prefersReducedMotion = useReducedMotion();
  const { isElectron, preventDialogDismissOnTitleBar } = useSystem();
  const tutorial = useTutorialContext();
  const tutorialSettingsStep = Boolean(
    tutorial?.step.id === 'settings_walkthrough' || tutorial?.step.id.startsWith('settings_'),
  );

  const views = visibleViews();
  const isCenteredPanel = view === 'about' || view === 'subscription';

  useEffect(() => {
    if (!window.electronAPI?.onOpenSettingsSection) return;
    const off = window.electronAPI.onOpenSettingsSection(({ section, action }) => {
      if (ALL_VIEWS.some(v => v.id === section)) {
        const target = section as SidebarView;
        if (target === 'startup' && !isElectronDesktop()) return;
        setView(target);
        setPendingAction(action);
        onOpenChange(true);
      }
    });
    return off;
  }, [onOpenChange]);

  useEffect(() => {
    if (!isElectronDesktop() && (view === 'startup' || view === 'about')) {
      setView('integrations');
    }
  }, [view]);

  useEffect(() => {
    if (open) return;
    setView('integrations');
    setPendingAction(undefined);
  }, [open]);

  useEffect(() => {
    if (!tutorialSettingsStep || !open) return;
    const match = tutorial?.step.id.match(/^settings_(.+)$/);
    if (!match) return;
    const sectionId = match[1] as SidebarView;
    if (ALL_VIEWS.some(v => v.id === sectionId)) {
      if (sectionId === 'startup' && !isElectronDesktop()) return;
      if (sectionId === 'about' && !isElectronDesktop()) return;
      setView(sectionId);
      setPendingAction(undefined);
    }
  }, [tutorial?.step.id, tutorialSettingsStep, open]);

  const ActivePanel = PANELS[view];

  const overlayTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.28, ease: veilEase };
  const contentTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.32, ease: veilEase };
  const contentInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.97, y: 10 };
  const contentAnimate = { opacity: 1, scale: 1, y: 0 };
  const contentExit = prefersReducedMotion
    ? { opacity: 0, transition: { duration: 0.1 } }
    : {
        opacity: 0,
        scale: 0.97,
        y: 10,
        transition: { duration: 0.2, ease: veilEase },
      };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={overlayTransition}
                className={cn(
                  dialogOverlayClass(isElectron),
                  tutorialSettingsStep && 'z-[10040]',
                )}
              />
            </Dialog.Overlay>
            <Dialog.Content
              data-tutorial-target="settings-panel-root"
              className={cn(
                isElectron ? dialogContentClass : dialogContentClassWeb,
                tutorialSettingsStep && 'z-[10045]',
              )}
              onPointerDownOutside={preventDialogDismissOnTitleBar}
              onInteractOutside={preventDialogDismissOnTitleBar}
            >
              <motion.div
                initial={contentInitial}
                animate={contentAnimate}
                exit={contentExit}
                transition={contentTransition}
                className={cn(
                  'glass-panel conic-border relative grid w-full overflow-hidden rounded-2xl shadow-2xl shadow-black/50 focus:outline-none [grid-template:1fr/1fr]',
                  isElectron
                    ? 'h-[min(800px,calc(100vh-var(--assistant-titlebar-offset,2rem)-2rem))]'
                    : 'h-[min(800px,88dvh)]',
                )}
              >
                <div className="relative col-start-1 row-start-1 min-h-0 overflow-hidden rounded-2xl">
                  <AmbientShader className="h-full w-full" intensity={0.25} />
                </div>

                <div className="relative col-start-1 row-start-1 flex min-h-0 flex-col">
                  <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
                    <Dialog.Title className="text-xl font-semibold text-zinc-50">Settings</Dialog.Title>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
                        aria-label="Close settings"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div className="flex min-h-0 flex-1">
                    <aside className="w-60 shrink-0 border-r border-white/5 bg-zinc-950/30 p-4">
                      <nav className="space-y-1">
                        {views.map(({ id, label, Icon }) => (
                          <button
                            key={id}
                            type="button"
                            data-tutorial-target={`settings-section-${id}`}
                            onClick={() => {
                              setView(id);
                              setPendingAction(undefined);
                            }}
                            className={cn(
                              'emerald-glow flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-base transition',
                              view === id
                                ? 'bg-emerald-500/10 text-emerald-200'
                                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </nav>
                    </aside>

                    <main
                      className={cn(
                        'flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none p-4 sm:p-5',
                        isCenteredPanel && 'items-center justify-center',
                      )}
                    >
                      <div className="flex min-h-0 w-full flex-1 flex-col">
                        <ActivePanel
                          pendingAction={pendingAction}
                          onActionConsumed={() => setPendingAction(undefined)}
                        />
                      </div>
                    </main>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}