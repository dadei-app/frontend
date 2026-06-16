import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { authApi } from '@dadei/ui/lib/workspace/api/auth';
import { triggerProviderOAuth } from '@dadei/ui/lib/platform/auth/providerAuth';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/platform/errors/userMessage';
import { settingsReturnPath } from '@dadei/ui/lib/platform/runtime/assistantPaths';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import { useMobileAssistant } from '@dadei/ui/lib/platform/hooks/useMobileAssistant';
import {
  GridTile,
  SettingsGrid4,
  settingsButtonClass,
  settingsInputClass,
  settingsPrimaryButtonClass,
  settingsReadonlyFieldClass,
  type SettingsPanelProps,
} from '@dadei/ui/components/settings/layout';
import { SegmentedControl } from '@dadei/ui/components/settings/controls';
import { useAuthMeQuery } from '@dadei/ui/lib/platform/query/queryHooks';
import { useTutorialSettingsTourActive } from '@dadei/ui/contexts/TutorialContext';
import { buildPopularTimezoneOptions } from './timezonePicker';
import { AccountSessionActions } from './AccountSessionActions';
import { GlassAlertModal } from '@dadei/ui/components/ui/GlassModal';
import { PasswordDialog } from './PasswordDialog';

function CenteredField({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-1">{children}</div>
  );
}

function AccountField({ mobile, children }: { mobile: boolean; children: ReactNode }) {
  if (mobile) {
    return <div className="w-full">{children}</div>;
  }
  return <CenteredField>{children}</CenteredField>;
}

export function AccountPanel({ pendingAction, onActionConsumed }: SettingsPanelProps) {
  const isMobile = useMobileAssistant();
  const queryClient = useQueryClient();
  const { user: me, updateNetwork, logout, saveTokens, refreshUser } = useAuth();
  const settingsTourActive = useTutorialSettingsTourActive();
  const authMeQuery = useAuthMeQuery(!settingsTourActive);
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

  const passwordHint = hasPassword ? 'Update your password.' : 'Add a password to your account.';

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    if (pendingAction !== 'oauth-linked-google') return;
    void refreshUser();
    void queryClient.invalidateQueries({ queryKey: queryKeys.integrationsStatus });
    showToast('Google account linked', 'success');
    onActionConsumed?.();
  }, [onActionConsumed, pendingAction, queryClient, refreshUser, showToast]);

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true);
    try {
      await triggerProviderOAuth('google', {
        saveTokens,
        onSuccess: () => {
          void refreshUser();
          void queryClient.invalidateQueries({ queryKey: queryKeys.integrationsStatus });
        },
        onError: msg => showToast(msg, 'error'),
        webNextPath: settingsReturnPath('account'),
        mode: 'link',
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

  const timezoneTile = (
    <GridTile
      title="Timezone"
      hint="Used for scheduling and reminders."
      stacked={isMobile}
      col={isMobile ? undefined : 1}
      row={isMobile ? undefined : 1}
      colSpan={isMobile ? undefined : 2}
      rowSpan={isMobile ? undefined : 4}
      className={isMobile ? 'account-timezone-tile shrink-0' : undefined}
      bodyClassName={isMobile ? undefined : 'min-h-0'}
      scrollable={isMobile}
    >
      <SegmentedControl
        layout="stack"
        scrollable
        options={timezoneOptions}
        value={selectedTz}
        onChange={tz => void updateNetwork({ timezone: tz })}
      />
    </GridTile>
  );

  const networkTile = (
    <GridTile
      title="Network name"
      hint="Shown in the assistant header."
      stacked={isMobile}
      col={isMobile ? undefined : 3}
      row={isMobile ? undefined : 1}
      colSpan={isMobile ? undefined : 2}
      rowSpan={isMobile ? undefined : 1}
      className={isMobile ? 'shrink-0' : undefined}
      bodyClassName={isMobile ? undefined : 'min-h-0'}
    >
      <AccountField mobile={isMobile}>
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
            'w-full border-white/10 bg-zinc-950/80',
            isMobile ? 'text-left' : 'max-w-md text-center',
          )}
        />
      </AccountField>
    </GridTile>
  );

  const emailTile = (
    <GridTile
      title="Email"
      hint="Your network identity — connected accounts may use other emails."
      stacked={isMobile}
      col={isMobile ? undefined : 3}
      row={isMobile ? undefined : 2}
      colSpan={isMobile ? undefined : 2}
      rowSpan={isMobile ? undefined : 1}
      className={isMobile ? 'shrink-0' : undefined}
      bodyClassName={isMobile ? undefined : 'min-h-0'}
    >
      <AccountField mobile={isMobile}>
        <input
          type="email"
          readOnly
          disabled
          value={email}
          title={email}
          className={cn(
            settingsReadonlyFieldClass,
            'w-full truncate',
            isMobile ? 'text-left text-[0.9375rem]' : 'max-w-md',
          )}
          aria-label="Account email"
        />
      </AccountField>
    </GridTile>
  );

  const passwordTile = (
    <GridTile
      title="Password"
      hint={passwordHint}
      stacked={isMobile}
      col={isMobile ? undefined : 3}
      row={isMobile ? undefined : 3}
      colSpan={isMobile ? undefined : 2}
      rowSpan={isMobile ? undefined : 1}
      className={isMobile ? 'shrink-0' : undefined}
      bodyClassName={isMobile ? undefined : 'min-h-0'}
    >
      <AccountField mobile={isMobile}>
        <div className={cn('w-full', !isMobile && 'max-w-md')}>
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
      </AccountField>
    </GridTile>
  );

  return (
    <>
      {isMobile ? (
        <div className="account-panel-mobile">
          {timezoneTile}
          {networkTile}
          {emailTile}
          {passwordTile}
        </div>
      ) : (
        <SettingsGrid4 className="min-h-0 flex-1">
          {timezoneTile}
          {networkTile}
          {emailTile}
          {passwordTile}
          <AccountSessionActions
            onLogout={() => void handleLogout()}
            onDeleteAccount={() => setAlertOpen(true)}
          />
        </SettingsGrid4>
      )}

      <PasswordDialog mode="set" open={showSetPassword} onOpenChange={setShowSetPassword} />
      <PasswordDialog mode="change" open={showChangePassword} onOpenChange={setShowChangePassword} />

      <GlassAlertModal
        open={alertOpen}
        onOpenChange={open => {
          setAlertOpen(open);
          if (!open) setDeletePhrase('');
        }}
        variant="destructive"
        icon={Trash2}
        title="Delete account?"
        description={
          <>
            This permanently removes your network and related data. Type your email{' '}
            <span className="font-medium text-zinc-300">{email}</span> to confirm.
          </>
        }
        confirmLabel="Delete forever"
        confirmingLabel="Deleting…"
        confirming={deleting}
        confirmDisabled={!canDelete}
        onConfirm={handleDeleteAccount}
      >
        <input
          type="text"
          value={deletePhrase}
          onChange={e => setDeletePhrase(e.target.value)}
          placeholder="Your email"
          className={settingsInputClass}
          autoComplete="off"
        />
      </GlassAlertModal>
    </>
  );
}
