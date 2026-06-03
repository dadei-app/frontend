import { useEffect, useMemo, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { authApi } from '@dadei/ui/lib/api/auth';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { useAuthMeQuery, useUpdateNetworkMutation } from '@dadei/ui/lib/query/queryHooks';
import { SettingsField } from '@dadei/ui/components/settings/panels/SettingsField';
import { SetPasswordDialog } from '@dadei/ui/components/settings/panels/SetPasswordDialog';
import { ChangePasswordDialog } from '@dadei/ui/components/settings/panels/ChangePasswordDialog';

export function AccountPanel() {
  const { user, logout } = useAuth();
  const { showToast } = useNotifications();
  const { data: me } = useAuthMeQuery(true);
  const updateNetwork = useUpdateNetworkMutation();
  const [name, setName] = useState(me?.name ?? '');
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    if (me?.name != null) setName(me.name);
  }, [me?.name]);

  const profile = me ?? user;
  const email = profile?.email ?? '—';
  const canDelete =
    !!profile && deletePhrase.trim().toLowerCase() === profile.email.trim().toLowerCase();

  const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzList = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [sysTz];
    }
  }, [sysTz]);

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteAccount = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await authApi.deleteMe();
      showToast('Account deleted', 'success');
      await logout();
    } catch (e: unknown) {
      showToast(getUserErrorMessage(e, 'Something went wrong. Please try again.'), 'error');
    } finally {
      setDeleting(false);
      setAlertOpen(false);
      setDeletePhrase('');
    }
  };

  return (
    <div className="conic-border glass-panel max-w-2xl space-y-6 rounded-lg p-5">
      <SettingsField label="Network name" hint="Visible in the assistant header.">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== me?.name) {
              updateNetwork.mutate({ name: trimmed });
            }
          }}
          className="w-full rounded-md border border-white/10 bg-zinc-900/60 px-3 py-2 text-zinc-100 emerald-glow"
        />
      </SettingsField>

      <SettingsField label="Timezone">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={me?.timezone ?? sysTz}
            onChange={e => updateNetwork.mutate({ timezone: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-900/60 px-3 py-2 text-zinc-100 emerald-glow"
          >
            {tzList.map(tz => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {me?.timezone !== sysTz ? (
            <button
              type="button"
              onClick={() => updateNetwork.mutate({ timezone: sysTz })}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Use system ({sysTz})
            </button>
          ) : null}
        </div>
      </SettingsField>

      <SettingsField label="Email">
        <input
          value={me?.email ?? ''}
          readOnly
          className="w-full cursor-not-allowed rounded-md border border-white/5 bg-zinc-950/40 px-3 py-2 text-zinc-500"
        />
      </SettingsField>

      <SettingsField
        label="Password"
        hint={
          !me?.has_password && me?.google_connected
            ? 'Add a password so you can sign in without Google.'
            : me?.has_password
              ? 'Update your account password.'
              : 'Set a password for email sign-in.'
        }
      >
        {!me?.has_password ? (
          <button
            type="button"
            onClick={() => setShowSetPassword(true)}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
          >
            Set a password
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowChangePassword(true)}
            className="rounded-md border border-white/10 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Change password
          </button>
        )}
        {me?.google_connected && me?.has_password ? (
          <p className="mt-2 text-xs text-zinc-500">Also linked to Google.</p>
        ) : null}
      </SettingsField>

      <div className="space-y-3 border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
        <button
          type="button"
          onClick={() => setAlertOpen(true)}
          className="inline-flex items-center gap-2 text-sm text-rose-300/90 hover:text-rose-200"
        >
          <Trash2 className="h-4 w-4" />
          Delete account…
        </button>
      </div>

      <SetPasswordDialog open={showSetPassword} onOpenChange={setShowSetPassword} />
      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />

      <AlertDialog.Root open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-300 bg-black/60 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-310 w-[min(90vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-rose-500/25 glass-panel p-6 focus:outline-none">
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
              onChange={e => setDeletePhrase(e.target.value)}
              placeholder="Your email"
              className="mt-4 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 emerald-glow"
              autoComplete="off"
            />
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button type="button" className="rounded-xl px-4 py-2 text-sm text-zinc-400">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                disabled={!canDelete || deleting}
                onClick={() => void handleDeleteAccount()}
                className="rounded-xl border border-rose-500/50 bg-rose-600/90 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
