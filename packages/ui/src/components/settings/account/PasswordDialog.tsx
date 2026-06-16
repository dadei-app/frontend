import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/platform/errors/userMessage';
import {
  useChangePasswordMutation,
  useSetPasswordMutation,
} from '@dadei/ui/lib/platform/query/queryHooks';
import {
  settingsInputClass,
  settingsPrimaryButtonClass,
} from '@dadei/ui/components/settings/layout';
import { veilEase } from '@dadei/ui/lib/platform/shared/motion';

export type PasswordDialogMode = 'set' | 'change';

const COPY = {
  set: {
    title: 'Set a password',
    description: 'Add a password to your account.',
    submitLabel: 'Save password',
    pendingLabel: 'Saving…',
    successToast: 'Password set',
    minLengthError: 'Password must be at least 8 characters.',
  },
  change: {
    title: 'Change password',
    description: 'Other devices will be signed out after you save.',
    submitLabel: 'Update password',
    pendingLabel: 'Saving…',
    successToast: 'Password updated',
    minLengthError: 'New password must be at least 8 characters.',
  },
} as const;

export type PasswordDialogProps = {
  mode: PasswordDialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PasswordDialog({ mode, open, onOpenChange }: PasswordDialogProps) {
  const copy = COPY[mode];
  const { showToast } = useNotifications();
  const setPasswordMutation = useSetPasswordMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const isPending =
    mode === 'set' ? setPasswordMutation.isPending : changePasswordMutation.isPending;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const prefersReducedMotion = useReducedMotion();
  const overlayTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.22, ease: veilEase };
  const contentInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.96, y: 8 };
  const contentAnimate = { opacity: 1, scale: 1, y: 0 };
  const contentExit = prefersReducedMotion
    ? { opacity: 0, transition: { duration: 0.1 } }
    : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.16, ease: veilEase } };
  const contentTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.26, ease: veilEase };

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
    setError('');
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setError('');
    if (newPassword.length < 8) {
      setError(copy.minLengthError);
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      if (mode === 'set') {
        await setPasswordMutation.mutateAsync(newPassword);
      } else {
        await changePasswordMutation.mutateAsync({
          current: currentPassword,
          next: newPassword,
        });
      }
      showToast(copy.successToast, 'success');
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      setError(getUserErrorMessage(e, 'Something went wrong. Please try again.'));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={overlayTransition}
                className="fixed inset-0 z-300 bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content
              className="fixed inset-0 z-310 flex items-center justify-center border-0 bg-transparent p-4 shadow-none outline-none focus:outline-none"
              style={{ top: 0, left: 0, transform: 'none' }}
            >
              <motion.div
                initial={contentInitial}
                animate={contentAnimate}
                exit={contentExit}
                transition={contentTransition}
                className="glass-panel conic-border relative w-[min(92vw,28rem)] rounded-2xl border border-white/10 p-6"
              >
                <Dialog.Title className="text-lg font-semibold text-zinc-50">
                  {copy.title}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-base text-zinc-400 font-secondary">
                  {copy.description}
                </Dialog.Description>

                <div className="mt-5 space-y-4">
                  {mode === 'change' ? (
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className={settingsInputClass}
                      autoComplete="current-password"
                    />
                  ) : null}
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
                    placeholder={mode === 'change' ? 'Confirm new password' : 'Confirm password'}
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
                    disabled={isPending}
                    onClick={() => void handleSubmit()}
                    className={`${settingsPrimaryButtonClass} disabled:opacity-50`}
                  >
                    {isPending ? copy.pendingLabel : copy.submitLabel}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
