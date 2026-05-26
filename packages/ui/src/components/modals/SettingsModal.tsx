import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Bell, Brain, CalendarDays, CheckSquare, LogOut, Mail, Trash2, X } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { authApi } from '@dadei/ui/lib/api/auth';
import { triggerGoogleOAuth } from '@dadei/ui/lib/googleAuth';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import {
  useAuthMeQuery,
  useMemoriesQuery,
  useDeleteMemoryMutation,
  useActionsQuery,
  useDeleteActionMutation,
} from '@dadei/ui/lib/queryHooks';
import type { EpisodicMemory, NetworkAction } from '@dadei/ui/types/models.types';
import SplitDeleteToolbar from '@dadei/ui/components/ui/SplitDeleteToolbar';

type AssistantSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

type SidebarView = 'memories' | 'events' | 'tasks' | 'reminders' | 'mail';

const viewMeta: Record<SidebarView, { label: string; Icon: typeof CalendarDays }> = {
  memories: { label: 'Memories', Icon: Brain },
  events: { label: 'Events', Icon: CalendarDays },
  tasks: { label: 'Tasks', Icon: CheckSquare },
  reminders: { label: 'Reminders', Icon: Bell },
  mail: { label: 'Mail', Icon: Mail },
};

const ACTION_TYPES_BY_VIEW: Record<Exclude<SidebarView, 'memories'>, string[]> = {
  events: ['calendar'],
  tasks: ['todo'],
  reminders: ['reminder'],
  mail: ['email', 'message'],
};

function actionDisplayText(action: NetworkAction): string {
  const details = action.details?.trim();
  if (details) {
    try {
      const parsed = JSON.parse(details) as { canonical_text?: unknown };
      if (typeof parsed.canonical_text === 'string' && parsed.canonical_text.trim()) {
        return parsed.canonical_text.trim();
      }
    } catch {
      /* not JSON */
    }
    return details;
  }
  return action.action_type;
}

export default function AssistantSettingsModal({ open, onOpenChange }: AssistantSettingsModalProps) {
  const { user, refreshUser, logout, saveTokens } = useAuth();
  const { isConnected } = useService();
  const { showToast } = useNotifications();
  const authMeQuery = useAuthMeQuery(open);
  const memoriesQuery = useMemoriesQuery(isConnected);
  const actionsQuery = useActionsQuery(open && isConnected);
  const deleteMemoryMutation = useDeleteMemoryMutation();
  const deleteActionMutation = useDeleteActionMutation();
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState('');
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [armedMemoryDeleteId, setArmedMemoryDeleteId] = useState<string | null>(null);
  const [armedActionDeleteId, setArmedActionDeleteId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<SidebarView>('memories');

  const profile = authMeQuery.data ?? user;
  const email = profile?.email ?? '—';
  const canDelete =
    !!profile && deletePhrase.trim().toLowerCase() === profile.email.trim().toLowerCase();
  const googleConnected = Boolean(profile?.google_connected);
  const activeViewMeta = viewMeta[activeView];

  const handleSignOut = async () => {
    onOpenChange(false);
    await logout();
  };

  const handleGoogleConnect = async () => {
    setGoogleConnectError('');
    const isElectron = Boolean(window.electronAPI);
    if (isElectron) {
      setConnectingGoogle(true);
    }
    try {
      await triggerGoogleOAuth({
        saveTokens,
        onSuccess: () => void refreshUser(),
        onError: (msg) => setGoogleConnectError(msg),
        webNextPath: '/auth/callback',
      });
    } finally {
      if (isElectron) {
        setConnectingGoogle(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await authApi.deleteMe();
      showToast('Account deleted', 'success');
      onOpenChange(false);
      await logout();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail)
          : e instanceof Error
            ? e.message
            : 'Failed to delete account';
      showToast(msg || 'Failed to delete account', 'error');
    } finally {
      setDeleting(false);
      setAlertOpen(false);
      setDeletePhrase('');
    }
  };

  const fetchErr = (e: unknown) =>
    typeof e === 'object' && e !== null && 'message' in e ? String((e as Error).message) : 'Request failed';

  const memoryRows = memoriesQuery.data ?? [];
  const workspaceActionRows =
    activeView === 'memories'
      ? []
      : (actionsQuery.data ?? []).filter((action) =>
          ACTION_TYPES_BY_VIEW[activeView].includes(action.action_type)
        );

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await deleteMemoryMutation.mutateAsync(memoryId);
      showToast('Memory deleted', 'success');
    } catch (error) {
      console.error('Failed to delete memory:', error);
      showToast('Failed to delete memory', 'error');
    } finally {
      setArmedMemoryDeleteId(null);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    try {
      await deleteActionMutation.mutateAsync(actionId);
      showToast('Action deleted', 'success');
    } catch (error) {
      console.error('Failed to delete action:', error);
      showToast('Failed to delete action', 'error');
    } finally {
      setArmedActionDeleteId(null);
    }
  };

  useEffect(() => {
    if (!armedMemoryDeleteId) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-split-delete]')) return;
      setArmedMemoryDeleteId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmedMemoryDeleteId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [armedMemoryDeleteId]);

  useEffect(() => {
    if (!armedActionDeleteId) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-split-delete]')) return;
      setArmedActionDeleteId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmedActionDeleteId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [armedActionDeleteId]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-240 bg-zinc-950/65 backdrop-blur-md" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-250 flex h-[min(92dvh,52rem)] w-[min(95vw,80rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/94 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl focus:outline-none">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight text-zinc-50">
                Settings
              </Dialog.Title>
              <p className="mt-1 text-sm text-zinc-500 font-secondary">Memories and Google Workspace</p>
            </div>
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

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,20rem)_1fr] lg:divide-x lg:divide-white/10">
            <aside className="flex min-h-0 flex-col overflow-y-auto overscroll-none p-5 sm:p-6">
              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveView('memories')}
                  className={`inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-secondary transition-colors ${
                    activeView === 'memories'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                  }`}
                >
                  <Brain className="h-4 w-4" />
                  Memories
                </button>
              </nav>

              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 font-secondary">
                  Google Workspace
                </p>
                <nav className="space-y-1">
                  {(['events', 'tasks', 'reminders', 'mail'] as SidebarView[]).map((view) => {
                    const { label, Icon } = viewMeta[view];
                    const isActive = activeView === view;
                    return (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setActiveView(view)}
                        className={`inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-secondary transition-colors ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => setAlertOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-950/40 px-4 py-2.5 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-950/70"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete account…
                </button>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <activeViewMeta.Icon className="h-4 w-4 text-emerald-400/90" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 font-secondary">
                  {activeViewMeta.label}
                </h3>
              </div>

              {activeView === 'memories' ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-none pr-1">
                  {!isConnected ? (
                    <p className="text-sm text-zinc-500 font-secondary">
                      Memories load after this device registers as a client (same as the interaction feed).
                    </p>
                  ) : memoriesQuery.isLoading ? (
                    <p className="text-sm text-zinc-500 font-secondary">Loading memories…</p>
                  ) : memoriesQuery.isError ? (
                    <p className="text-sm text-rose-300/90 font-secondary">{fetchErr(memoriesQuery.error)}</p>
                  ) : memoryRows.length === 0 ? (
                    <p className="text-sm text-zinc-500 font-secondary">
                      No episodic memories yet. They appear after conversations are processed.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {memoryRows.map((m: EpisodicMemory) => (
                        <li
                          key={m.id}
                          className="group/memory rounded-lg border border-white/[0.07] bg-zinc-950/40 px-3 py-2.5"
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug text-zinc-100">{m.canonical_text}</p>
                              <p className="mt-1 text-xs text-zinc-500 font-secondary">
                                {m.memory_type} · {m.status} · {formatWhen(m.created_at)}
                              </p>
                            </div>
                            <SplitDeleteToolbar
                              armed={armedMemoryDeleteId === m.id}
                              disabled={deleteMemoryMutation.isPending}
                              onArm={() => {
                                setArmedMemoryDeleteId(m.id);
                              }}
                              onDisarm={() => setArmedMemoryDeleteId(null)}
                              onConfirm={() => {
                                void handleDeleteMemory(m.id);
                              }}
                              idleTitle="Delete memory"
                              idleAriaLabel="Delete memory"
                              idleVisibleClassName="group-hover/memory:opacity-100"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="relative min-h-0 flex-1">
                  <div className={`min-h-0 flex-1 overflow-y-auto overscroll-none pr-1 ${googleConnected ? '' : 'opacity-35'}`}>
                    {!isConnected ? (
                      <p className="text-sm text-zinc-500 font-secondary">
                        Actions load after this device registers as a client.
                      </p>
                    ) : actionsQuery.isLoading ? (
                      <p className="text-sm text-zinc-500 font-secondary">Loading actions…</p>
                    ) : actionsQuery.isError ? (
                      <p className="text-sm text-rose-300/90 font-secondary">{fetchErr(actionsQuery.error)}</p>
                    ) : workspaceActionRows.length === 0 ? (
                      <p className="text-sm text-zinc-500 font-secondary">
                        No {activeViewMeta.label.toLowerCase()} yet. They appear when conversations surface
                        actionable {activeViewMeta.label.toLowerCase()}.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {workspaceActionRows.map((action: NetworkAction) => (
                          <li
                            key={action.id}
                            className="group/action rounded-lg border border-white/[0.07] bg-zinc-950/40 px-3 py-2.5"
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm leading-snug text-zinc-100">
                                  {actionDisplayText(action)}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500 font-secondary">
                                  {action.status}
                                  {action.scheduled_time
                                    ? ` · ${formatWhen(action.scheduled_time)}`
                                    : ''}
                                  {` · ${formatWhen(action.created_at)}`}
                                </p>
                              </div>
                              <SplitDeleteToolbar
                                armed={armedActionDeleteId === action.id}
                                disabled={deleteActionMutation.isPending}
                                onArm={() => {
                                  setArmedActionDeleteId(action.id);
                                }}
                                onDisarm={() => setArmedActionDeleteId(null)}
                                onConfirm={() => {
                                  void handleDeleteAction(action.id);
                                }}
                                idleTitle="Delete action"
                                idleAriaLabel="Delete action"
                                idleVisibleClassName="group-hover/action:opacity-100"
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {!googleConnected ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-zinc-900/60 backdrop-blur-sm">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                        <FcGoogle className="h-6 w-6" aria-hidden />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleGoogleConnect()}
                        disabled={connectingGoogle}
                        className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-zinc-800/85 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {connectingGoogle ? 'Connecting…' : 'Connect Google'}
                      </button>
                      {googleConnectError ? (
                        <p className="text-xs text-rose-300/90 font-secondary">{googleConnectError}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      <AlertDialog.Root open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-260 bg-black/60 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-270 w-[min(90vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-rose-500/25 bg-zinc-900 p-6 shadow-2xl focus:outline-none">
            <AlertDialog.Title className="text-base font-semibold text-zinc-50">
              Delete account?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-zinc-400 font-secondary">
              This permanently removes your network and related data. Type your email{' '}
              <span className="font-medium text-zinc-300">{email}</span> to confirm.
            </AlertDialog.Description>
            <input
              type="text"
              value={deletePhrase}
              onChange={(e) => setDeletePhrase(e.target.value)}
              placeholder="Your email"
              className="mt-4 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 font-primary text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/40 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
              autoComplete="off"
            />
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                disabled={!canDelete || deleting}
                onClick={() => void handleDeleteAccount()}
                className="rounded-xl border border-rose-500/50 bg-rose-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Dialog.Root>
  );
}
