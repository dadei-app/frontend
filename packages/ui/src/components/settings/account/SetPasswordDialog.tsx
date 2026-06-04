import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { useSetPasswordMutation } from '@dadei/ui/lib/query/queryHooks';
import {
  settingsInputClass,
  settingsPrimaryButtonClass,
} from '@dadei/ui/components/settings/layout';

const nestedDialogContentClass =
  'fixed inset-0 z-310 flex items-center justify-center border-0 bg-transparent p-4 shadow-none outline-none';

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
        <Dialog.Content
          className={nestedDialogContentClass}
          style={{ top: 0, left: 0, transform: 'none' }}
        >
          <div className="glass-panel conic-border relative w-[min(92vw,28rem)] rounded-2xl border border-white/10 p-6">
            <Dialog.Title className="text-lg font-semibold text-zinc-50">Set a password</Dialog.Title>
            <Dialog.Description className="mt-2 text-base text-zinc-400 font-secondary">
              Add a password so you can sign in without Google.
            </Dialog.Description>
            <div className="mt-5 space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password"
                className={settingsInputClass}
                autoComplete="new-password"
              />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm password"
                className={settingsInputClass}
                autoComplete="new-password"
              />
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-xl px-4 py-2.5 text-base text-zinc-400 hover:bg-white/5"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => void handleSubmit()}
                className={`${settingsPrimaryButtonClass} disabled:opacity-50`}
              >
                {mutation.isPending ? 'Saving…' : 'Save password'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
