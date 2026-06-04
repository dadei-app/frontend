import { useEffect, useMemo, useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';

import * as AlertDialog from '@radix-ui/react-alert-dialog';

import { LogOut, Trash2 } from 'lucide-react';

import { useAuth } from '@dadei/ui/contexts/AuthContext';

import { authApi } from '@dadei/ui/lib/api/auth';

import { useNotifications } from '@dadei/ui/contexts/NotificationContext';

import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';

import { useAuthMeQuery, useUpdateNetworkMutation } from '@dadei/ui/lib/query/queryHooks';

import { cn } from '@dadei/ui/lib/shared/cn';

import { veilEase } from '@dadei/ui/lib/shared/motion';

import { GridTile, SegmentedControl, SettingsGrid4 } from '@dadei/ui/components/settings/shared';
import {
  settingsButtonClass,
  settingsInputClass,
  settingsPrimaryButtonClass,
} from '@dadei/ui/components/settings/shared/SettingsPanelLayout';
import { buildPopularTimezoneOptions } from './timezonePicker';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { SetPasswordDialog } from './SetPasswordDialog';



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

  const selectedTz = me?.timezone ?? sysTz;



  const timezoneOptions = useMemo(

    () => buildPopularTimezoneOptions(sysTz, selectedTz),

    [sysTz, selectedTz],

  );



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

    <>

      <SettingsGrid4 className="min-h-0 flex-1">

        <GridTile

          title="Timezone"

          hint="Used for scheduling and reminders."

          col={1}

          row={1}

          colSpan={2}

          rowSpan={3}

          bodyClassName="overflow-y-auto overscroll-none"

        >

          <SegmentedControl

            layout="stack"

            options={timezoneOptions}

            value={selectedTz}

            onChange={tz => updateNetwork.mutate({ timezone: tz })}

          />

        </GridTile>



        <GridTile title="Network name" hint="Shown in the assistant header." col={3} row={1} colSpan={2} rowSpan={1}>

          <input

            value={name}

            onChange={e => setName(e.target.value)}

            onBlur={() => {

              const trimmed = name.trim();

              if (trimmed && trimmed !== me?.name) {

                updateNetwork.mutate({ name: trimmed });

              }

            }}

            className={cn(settingsInputClass, 'border-white/10 bg-zinc-950/80')}

          />

        </GridTile>



        <GridTile title="Email" col={3} row={2} colSpan={2} rowSpan={1}>

          <p className="truncate rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2.5 text-sm text-zinc-300">

            {me?.email ?? '—'}

          </p>

        </GridTile>



        <GridTile

          title="Password"

          hint={

            !me?.has_password && me?.google_connected

              ? 'Sign in without Google.'

              : me?.has_password

                ? 'Update your password.'

                : 'Email sign-in.'

          }

          col={3}

          row={3}

          colSpan={2}

          rowSpan={1}

        >

          <AnimatePresence mode="wait">

            {!me?.has_password ? (

              <motion.button

                key="set-password"

                type="button"

                initial={{ opacity: 0, y: 10, scale: 0.94 }}

                animate={{ opacity: 1, y: 0, scale: 1 }}

                exit={{ opacity: 0, y: -6, scale: 0.97 }}

                transition={{ duration: 0.32, ease: veilEase }}

                onClick={() => setShowSetPassword(true)}

                className={cn(settingsPrimaryButtonClass, 'w-full')}

              >

                Set a password

              </motion.button>

            ) : (

              <motion.button

                key="change-password"

                type="button"

                initial={{ opacity: 0, y: 8 }}

                animate={{ opacity: 1, y: 0 }}

                exit={{ opacity: 0 }}

                transition={{ duration: 0.22, ease: veilEase }}

                onClick={() => setShowChangePassword(true)}

                className={cn(settingsButtonClass, 'w-full')}

              >

                Change password

              </motion.button>

            )}

          </AnimatePresence>

          {me?.google_connected && me?.has_password ? (

            <p className="mt-2 text-xs text-zinc-500">Also linked to Google.</p>

          ) : null}

        </GridTile>



        <GridTile col={1} row={4} colSpan={4} rowSpan={1} className="py-3">

          <div className="flex h-full items-center justify-between gap-6">

            <button

              type="button"

              onClick={() => void handleLogout()}

              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"

            >

              <LogOut className="h-4 w-4" />

              Log out

            </button>

            <button

              type="button"

              onClick={() => setAlertOpen(true)}

              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-rose-300/90 transition hover:bg-rose-500/10 hover:text-rose-200"

            >

              <Trash2 className="h-4 w-4" />

              Delete account

            </button>

          </div>

        </GridTile>

      </SettingsGrid4>



      <SetPasswordDialog open={showSetPassword} onOpenChange={setShowSetPassword} />

      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />



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


