import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { authApi } from '@dadei/ui/lib/api/auth';
import { triggerGoogleOAuth } from '@dadei/ui/lib/auth/googleAuth';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/assistantPaths';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { cn } from '@dadei/ui/lib/shared/cn';
import {
  GridTile,
  SettingsGrid4,
  settingsButtonClass,
  settingsInputClass,
  settingsPrimaryButtonClass,
  settingsReadonlyFieldClass,
} from '@dadei/ui/components/settings/layout';
import { SegmentedControl } from '@dadei/ui/components/settings/controls';
import { useAuthMeQuery } from '@dadei/ui/lib/query/queryHooks';
import { buildPopularTimezoneOptions } from './timezonePicker';
import { AccountSessionActions } from './AccountSessionActions';
import { PasswordDialog } from './PasswordDialog';

function CenteredField({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-1">{children}</div>
  );
}

export function AccountPanel() {
  const queryClient = useQueryClient();
  const { user: me, updateNetwork, logout, saveTokens, refreshUser } = useAuth();
  const authMeQuery = useAuthMeQuery(true);
  const profile = authMeQuery.data ?? me;
  const hasPassword = profile?.has_password === true;
  const googleConnected = profile?.google_connected === true;
  const { showToast } = useNotifications();
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [name, setName] = useState(me?.name ?? '');
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    if (profile?.name != null) setName(profile.name);
  }, [profile?.name]);

  const email = profile?.email ?? '—';
  const canDelete =
    !!profile && deletePhrase.trim().toLowerCase() === profile.email.trim().toLowerCase();

  const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selectedTz = profile?.timezone ?? sysTz;

  const timezoneOptions = useMemo(
    () => buildPopularTimezoneOptions(sysTz, selectedTz),
    [sysTz, selectedTz],
  );

  const handleLogout = async () => {
    await logout();
  };

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true);
    try {
      await triggerGoogleOAuth({
        saveTokens,
        onSuccess: () => {
          void refreshUser();
          void queryClient.invalidateQueries({ queryKey: queryKeys.integrationsStatus });
          showToast('Google account linked', 'success');
        },
        onError: msg => showToast(msg, 'error'),
        webNextPath: ASSISTANT_PATH,
      });
    } finally {
      setLinkingGoogle(false);
    }
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
    <>
      <SettingsGrid4 className="min-h-0 flex-1">
        <GridTile
          title="Timezone"
          hint="Used for scheduling and reminders."
          col={1}
          row={1}
          colSpan={2}
          rowSpan={4}
          bodyClassName="min-h-0"
        >
          <SegmentedControl
            layout="stack"
            scrollable
            options={timezoneOptions}
            value={selectedTz}
            onChange={tz => void updateNetwork({ timezone: tz })}
          />
        </GridTile>

        <GridTile
          title="Network name"
          hint="Shown in the assistant header."
          col={3}
          row={1}
          colSpan={2}
          rowSpan={1}
          bodyClassName="min-h-0"
        >
          <CenteredField>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => {
                const trimmed = name.trim();
                if (trimmed && trimmed !== profile?.name) {
                  void updateNetwork({ name: trimmed });
                }
              }}
              className={cn(
                settingsInputClass,
                'w-full max-w-md border-white/10 bg-zinc-950/80 text-center',
              )}
            />
          </CenteredField>
        </GridTile>

        <GridTile
          title="Email"
          hint="Managed by your sign-in provider."
          col={3}
          row={2}
          colSpan={2}
          rowSpan={1}
          bodyClassName="min-h-0"
        >
          <CenteredField>
            <input
              type="email"
              readOnly
              disabled
              value={email}
              title={email}
              className={cn(settingsReadonlyFieldClass, 'max-w-md truncate')}
              aria-label="Account email"
            />
          </CenteredField>
        </GridTile>

        <GridTile
          title="Password"
          hint={
            !hasPassword && profile?.google_connected
              ? 'Sign in without Google.'
              : hasPassword
                ? 'Update your password.'
                : 'Email sign-in.'
          }
          col={3}
          row={3}
          colSpan={2}
          rowSpan={1}
          bodyClassName="min-h-0"
        >
          <CenteredField>
            <div className="w-full max-w-md">
              {hasPassword ? (
                <button
                  type="button"
                  onClick={() => setShowChangePassword(true)}
                  className={cn(settingsButtonClass, 'w-full')}
                >
                  Change password
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSetPassword(true)}
                  className={cn(settingsPrimaryButtonClass, 'w-full')}
                >
                  Set a password
                </button>
              )}
              {!googleConnected ? (
                <button
                  type="button"
                  disabled={linkingGoogle}
                  onClick={() => void handleLinkGoogle()}
                  className={cn(settingsButtonClass, 'mt-2 w-full disabled:opacity-50')}
                >
                  {linkingGoogle ? 'Connecting…' : 'Link Google account'}
                </button>
              ) : null}
            </div>
          </CenteredField>
        </GridTile>

        <AccountSessionActions
          onLogout={() => void handleLogout()}
          onDeleteAccount={() => setAlertOpen(true)}
        />
      </SettingsGrid4>

      <PasswordDialog mode="set" open={showSetPassword} onOpenChange={setShowSetPassword} />
      <PasswordDialog mode="change" open={showChangePassword} onOpenChange={setShowChangePassword} />

      <AlertDialog.Root open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-300 bg-black/60 backdrop-blur-sm" />
          <AlertDialog.Content
            className="fixed inset-0 z-310 flex items-center justify-center border-0 bg-transparent p-4 shadow-none outline-none"
            style={{ top: 0, left: 0, transform: 'none' }}
          >
            <div className="glass-panel relative w-[min(92vw,28rem)] rounded-2xl border border-rose-500/25 p-6">
              <AlertDialog.Title className="text-lg font-semibold text-zinc-50">
                Delete account?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-base text-zinc-400 font-secondary">
                This permanently removes your network and related data. Type your email{' '}
                <span className="font-medium text-zinc-300">{email}</span> to confirm.
              </AlertDialog.Description>
              <input
                type="text"
                value={deletePhrase}
                onChange={e => setDeletePhrase(e.target.value)}
                placeholder="Your email"
                className={cn(settingsInputClass, 'mt-4')}
                autoComplete="off"
              />
              <div className="mt-6 flex justify-end gap-3">
                <AlertDialog.Cancel asChild>
                  <button type="button" className="rounded-xl px-4 py-2.5 text-base text-zinc-400">
                    Cancel
                  </button>
                </AlertDialog.Cancel>
                <button
                  type="button"
                  disabled={!canDelete || deleting}
                  onClick={() => void handleDeleteAccount()}
                  className="rounded-xl border border-rose-500/50 bg-rose-600/90 px-4 py-2.5 text-base font-semibold text-white disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
