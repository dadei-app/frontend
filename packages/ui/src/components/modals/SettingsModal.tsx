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
import { IntegrationsPanel } from '@dadei/ui/components/settings/panels/IntegrationsPanel';
import { MemoriesPanel } from '@dadei/ui/components/settings/panels/MemoriesPanel';
import { AccountPanel } from '@dadei/ui/components/settings/panels/AccountPanel';
import { AudioPanel } from '@dadei/ui/components/settings/panels/AudioPanel';
import { StartupPanel } from '@dadei/ui/components/settings/panels/StartupPanel';
import { SubscriptionPanel } from '@dadei/ui/components/settings/panels/SubscriptionPanel';
import { AboutPanel } from '@dadei/ui/components/settings/panels/AboutPanel';
import type { SettingsPanelProps } from '@dadei/ui/components/settings/panels/types';
import { cn } from '@dadei/ui/lib/shared/cn';
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

const VIEWS: { id: SidebarView; label: string; Icon: LucideIcon }[] = [
  { id: 'integrations', label: 'Integrations', Icon: Plug },
  { id: 'memories', label: 'Memories', Icon: Brain },
  { id: 'account', label: 'Account', Icon: UserCircle2 },
  { id: 'audio', label: 'Audio', Icon: Mic },
  { id: 'startup', label: 'Startup', Icon: Power },
  { id: 'subscription', label: 'Subscription', Icon: Sparkles },
  { id: 'about', label: 'About', Icon: Info },
];

const PANELS: Record<SidebarView, React.ComponentType<SettingsPanelProps>> = {
  integrations: IntegrationsPanel,
  memories: MemoriesPanel,
  account: AccountPanel,
  audio: AudioPanel,
  startup: StartupPanel,
  subscription: SubscriptionPanel,
  about: AboutPanel,
};

export default function AssistantSettingsModal({ open, onOpenChange }: AssistantSettingsModalProps) {
  const [view, setView] = useState<SidebarView>('integrations');
  const [pendingAction, setPendingAction] = useState<string | undefined>(undefined);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!window.electronAPI?.onOpenSettingsSection) return;
    const off = window.electronAPI.onOpenSettingsSection(({ section, action }) => {
      if (VIEWS.some(v => v.id === section)) {
        setView(section as SidebarView);
        setPendingAction(action);
        onOpenChange(true);
      }
    });
    return off;
  }, [onOpenChange]);

  useEffect(() => {
    if (open) return;
    setView('integrations');
    setPendingAction(undefined);
  }, [open]);

  const ActivePanel = PANELS[view];

  const overlayTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.28, ease: veilEase };
  const contentTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.32, ease: veilEase };
  const contentInitial = prefersReducedMotion
    ? { opacity: 0, x: '-50%', y: '-50%' }
    : { opacity: 0, scale: 0.97, x: '-50%', y: 'calc(-50% + 10px)' };
  const contentAnimate = { opacity: 1, scale: 1, x: '-50%', y: '-50%' };
  const contentExit = prefersReducedMotion
    ? { opacity: 0, x: '-50%', y: '-50%', transition: { duration: 0.1 } }
    : {
        opacity: 0,
        scale: 0.97,
        x: '-50%',
        y: 'calc(-50% + 10px)',
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
                className="fixed inset-0 z-240 bg-zinc-950/65 backdrop-blur-md"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={contentInitial}
                animate={contentAnimate}
                exit={contentExit}
                transition={contentTransition}
                className="glass-panel conic-border fixed left-1/2 top-1/2 z-250 flex h-[min(92dvh,40rem)] w-[min(95vw,64rem)] flex-col overflow-hidden rounded-2xl focus:outline-none will-change-transform"
              >
                <div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl">
                  <AmbientShader className="absolute inset-0" intensity={0.25} />
                </div>

                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
                  <Dialog.Title className="text-lg font-semibold text-zinc-50">Settings</Dialog.Title>
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
                  <aside className="w-56 shrink-0 border-r border-white/5 bg-zinc-950/30 p-3">
                    <nav className="space-y-1">
                      {VIEWS.map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setView(id);
                            setPendingAction(undefined);
                          }}
                          className={cn(
                            'emerald-glow flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition',
                            view === id
                              ? 'bg-emerald-500/10 text-emerald-200'
                              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </nav>
                  </aside>

                  <main className="min-h-0 flex-1 overflow-y-auto overscroll-none p-5 sm:p-6">
                    <ActivePanel
                      pendingAction={pendingAction}
                      onActionConsumed={() => setPendingAction(undefined)}
                    />
                  </main>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
