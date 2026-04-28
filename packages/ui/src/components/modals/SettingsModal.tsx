import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Brain, ListTodo, LogOut, Trash2, X } from 'lucide-react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { authApi } from '@dadei/ui/lib/api/auth';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import {
  useAuthMeQuery,
  useMemoriesQuery,
  useActionsQuery,
  useDeleteActionMutation,
  useDeleteMemoryMutation,
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

function actionSummary(details: string | null): string | undefined {
  if (!details?.trim()) return undefined;
  try {
    const o = JSON.parse(details) as { canonical_text?: string };
    if (typeof o.canonical_text === 'string' && o.canonical_text.trim()) {
      return o.canonical_text.trim();
    }
  } catch {
    /* plain text */
  }
  return details.length > 120 ? `${details.slice(0, 117)}…` : details;
}

export default function AssistantSettingsModal({ open, onOpenChange }: AssistantSettingsModalProps) {
  const { user, refreshUser, logout } = useAuth();
  const { isConnected } = useService();
  const { showToast } = useNotifications();
  const authMeQuery = useAuthMeQuery(open);
  const memoriesQuery = useMemoriesQuery(isConnected);
  const actionsQuery = useActionsQuery(isConnected);
  const deleteMemoryMutation = useDeleteMemoryMutation();
  const deleteActionMutation = useDeleteActionMutation();
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [armedMemoryDeleteId, setArmedMemoryDeleteId] = useState<string | null>(null);
  const [armedActionDeleteId, setArmedActionDeleteId] = useState<string | null>(null);

  const profile = authMeQuery.data ?? user;
  const email = profile?.email ?? '—';
  const canDelete =
    !!profile && deletePhrase.trim().toLowerCase() === profile.email.trim().toLowerCase();

  const handleSignOut = async () => {
    onOpenChange(false);
    await logout();
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
  const actionRows = actionsQuery.data ?? [];

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
    if (!armedMemoryDeleteId && !armedActionDeleteId) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-split-delete]')) return;
      setArmedMemoryDeleteId(null);
      setArmedActionDeleteId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmedMemoryDeleteId(null);
        setArmedActionDeleteId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [armedMemoryDeleteId, armedActionDeleteId]);

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
              <p className="mt-1 text-sm text-zinc-500 font-secondary">Account, Dadei&apos;s memory, and actions</p>
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
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-none p-5 sm:p-6">
              <section className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 font-secondary">
                  Account
                </h3>
                <p className="mt-2 text-sm text-zinc-400 font-secondary">Email</p>
                <p className="mt-0.5 font-medium text-zinc-100">{email}</p>
                {profile?.has_password === false ? (
                  <p className="mt-2 text-xs text-zinc-500 font-secondary">
                    Signed in with Google — no password on file.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void refreshUser()}
                  className="mt-3 text-xs font-medium text-emerald-400/90 hover:text-emerald-300 font-secondary"
                >
                  Refresh profile
                </button>
              </section>

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
            </div>

            <div className="grid min-h-0 grid-rows-2 gap-0 divide-y divide-white/10 lg:grid-rows-2">
              <section className="flex min-h-0 flex-col p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-emerald-400/90" aria-hidden />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 font-secondary">
                    Dadei&apos;s memory
                  </h3>
                </div>
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
                                setArmedActionDeleteId(null);
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
              </section>

              <section className="flex min-h-0 flex-col p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-cyan-400/90" aria-hidden />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 font-secondary">
                    Actions
                  </h3>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-none pr-1">
                  {!isConnected ? (
                    <p className="text-sm text-zinc-500 font-secondary">
                      Actions load after this device registers as a client (same as the interaction feed).
                    </p>
                  ) : actionsQuery.isLoading ? (
                    <p className="text-sm text-zinc-500 font-secondary">Loading actions…</p>
                  ) : actionsQuery.isError ? (
                    <p className="text-sm text-rose-300/90 font-secondary">{fetchErr(actionsQuery.error)}</p>
                  ) : actionRows.length === 0 ? (
                    <p className="text-sm text-zinc-500 font-secondary">No actions yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {actionRows.map((a: NetworkAction) => (
                        <li
                          key={a.id}
                          className="group/action rounded-lg border border-white/[0.07] bg-zinc-950/40 px-3 py-2.5"
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium capitalize text-zinc-100">
                                {a.action_type.replace(/_/g, ' ')} · {a.status}
                              </p>
                              {actionSummary(a.details) ? (
                                <p className="mt-1 text-xs leading-snug text-zinc-400 font-secondary">
                                  {actionSummary(a.details)}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs text-zinc-500 font-secondary">
                                Scheduled: {formatWhen(a.scheduled_time)} · {formatWhen(a.created_at)}
                              </p>
                            </div>
                            <SplitDeleteToolbar
                              armed={armedActionDeleteId === a.id}
                              disabled={deleteActionMutation.isPending}
                              onArm={() => {
                                setArmedMemoryDeleteId(null);
                                setArmedActionDeleteId(a.id);
                              }}
                              onDisarm={() => setArmedActionDeleteId(null)}
                              onConfirm={() => {
                                void handleDeleteAction(a.id);
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
              </section>
            </div>
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
