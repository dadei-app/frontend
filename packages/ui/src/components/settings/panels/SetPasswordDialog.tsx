import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { useSetPasswordMutation } from '@dadei/ui/lib/query/queryHooks';

export function SetPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { showToast } = useNotifications();
  const mutation = useSetPasswordMutation();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setNewPassword('');
    setConfirm('');
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await mutation.mutateAsync(newPassword);
      showToast('Password set', 'success');
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      setError(getUserErrorMessage(e, 'Something went wrong. Please try again.'));
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={v => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-300 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-310 w-[min(90vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 glass-panel conic-border p-6 focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-zinc-50">Set a password</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-zinc-400 font-secondary">
            Add a password so you can sign in without Google.
          </Dialog.Description>
          <div className="mt-4 space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-md border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 emerald-glow"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-md border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 emerald-glow"
              autoComplete="new-password"
            />
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:bg-white/5"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => void handleSubmit()}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save password'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
