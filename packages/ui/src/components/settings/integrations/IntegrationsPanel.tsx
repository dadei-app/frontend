import { useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import {

  CalendarDays,

  CheckSquare,

  Clock3,

  CloudSun,

  FileText,

  Globe,

  HardDrive,

  Mail,

  Map,

  Plug,

  Table,

  Users,

} from 'lucide-react';

import { useAuth } from '@dadei/ui/contexts/AuthContext';

import { triggerGoogleOAuth } from '@dadei/ui/lib/auth/googleAuth';

import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';

import { useAuthMeQuery, useIntegrationsStatusQuery } from '@dadei/ui/lib/query/queryHooks';

import { queryKeys } from '@dadei/ui/lib/query/queryKeys';

import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/assistantPaths';

import { cn } from '@dadei/ui/lib/shared/cn';

import {
  GridTile,
  SegmentedOption,
  SegmentedShell,
  SettingsGrid4,
} from '@dadei/ui/components/settings/shared';



const INTEGRATION_ICONS: Record<string, typeof CalendarDays> = {

  gmail: Mail,

  calendar: CalendarDays,

  contacts: Users,

  tasks: CheckSquare,

  docs: FileText,

  drive: HardDrive,

  sheets: Table,

};



const REALTIME_DATA_SOURCES: Array<{ name: string; detail: string; Icon: typeof CalendarDays }> = [

  { name: 'Weather', detail: 'Live conditions and short-term forecast lookups.', Icon: CloudSun },

  { name: 'Maps', detail: 'Place and routing lookups for local context.', Icon: Map },

  { name: 'Web Search', detail: 'Fresh web answers and source retrieval.', Icon: Globe },

  { name: 'Current Time', detail: 'Timezone-aware clock checks without extra auth.', Icon: Clock3 },

];



function statusBadgeClass(isConnected: boolean, isReauth: boolean): string {

  if (isConnected) return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';

  if (isReauth) return 'border-amber-500/40 bg-amber-500/15 text-amber-300';

  return 'border-zinc-600/80 bg-zinc-800/80 text-zinc-400';

}



function accessBadgeClass(granted: boolean, googleConnected: boolean): string {

  if (granted) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';

  if (googleConnected) return 'border-amber-500/25 bg-amber-500/10 text-amber-200';

  return 'border-zinc-700 bg-zinc-800/80 text-zinc-500';

}



function GoogleServiceCard({

  integration,

  googleConnected,

  connectingGoogle,

  onReauth,

}: {

  integration: {

    id: string;

    name: string;

    status: string;

    access: Array<{ kind: string; granted: boolean }>;

    Icon: typeof CalendarDays;

  };

  googleConnected: boolean;

  connectingGoogle: boolean;

  onReauth: () => void;

}) {

  const isConnectedStatus = integration.status === 'connected';

  const isReauthStatus = integration.status === 'needs_reauth';



  return (

    <article className="flex min-h-0 flex-col justify-between gap-2 rounded-lg border border-white/8 bg-zinc-900/70 p-2.5">

      <div className="flex items-start justify-between gap-1.5">

        <div className="flex min-w-0 items-center gap-1.5">

          <integration.Icon className="h-3.5 w-3.5 shrink-0 text-emerald-300/90" aria-hidden />

          <p className="truncate text-xs font-medium text-zinc-100">{integration.name}</p>

        </div>

        <span

          className={cn(

            'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-secondary leading-none',

            statusBadgeClass(isConnectedStatus, isReauthStatus),

          )}

        >

          {isConnectedStatus ? 'On' : isReauthStatus ? 'Re-auth' : 'Off'}

        </span>

      </div>

      <div className="flex flex-wrap gap-1">

        {integration.access.map(badge => (

          <span

            key={`${integration.id}-${badge.kind}`}

            className={cn(

              'rounded border px-1.5 py-0.5 text-[10px] font-medium font-secondary',

              accessBadgeClass(badge.granted, googleConnected),

            )}

          >

            {badge.kind === 'read' ? 'Read' : 'Write'}

          </span>

        ))}

      </div>

      {isReauthStatus && googleConnected ? (

        <button

          type="button"

          onClick={onReauth}

          disabled={connectingGoogle}

          className="w-full rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"

        >

          {connectingGoogle ? '…' : 'Re-authorize'}

        </button>

      ) : null}

    </article>

  );

}



export function IntegrationsPanel() {

  const queryClient = useQueryClient();

  const { user, refreshUser, saveTokens } = useAuth();

  const authMeQuery = useAuthMeQuery(true);

  const integrationsStatusQuery = useIntegrationsStatusQuery(true);

  const [googleConnectError, setGoogleConnectError] = useState('');

  const [connectingGoogle, setConnectingGoogle] = useState(false);



  const profile = authMeQuery.data ?? user;

  const integrationsStatus = integrationsStatusQuery.data;

  const googleConnected =

    integrationsStatus?.google_connected ?? Boolean(profile?.google_connected);



  const integrationCards = useMemo(

    () =>

      (integrationsStatus?.integrations ?? []).map(integration => ({

        ...integration,

        Icon: INTEGRATION_ICONS[integration.id] ?? Plug,

      })),

    [integrationsStatus?.integrations],

  );



  const handleGoogleConnect = async () => {

    setGoogleConnectError('');

    const isElectron = Boolean(window.electronAPI);

    if (isElectron) setConnectingGoogle(true);

    try {

      await triggerGoogleOAuth({

        saveTokens,

        onSuccess: () => {

          void refreshUser();

          void queryClient.invalidateQueries({ queryKey: queryKeys.integrationsStatus });

        },

        onError: msg => setGoogleConnectError(msg),

        webNextPath: ASSISTANT_PATH,

      });

    } finally {

      if (isElectron) setConnectingGoogle(false);

    }

  };



  const fetchErr = (e: unknown) => getUserErrorMessage(e, 'Something went wrong. Please try again.');



  return (

    <SettingsGrid4 className="min-h-0 flex-1">

      <GridTile

        title="Google Workspace"

        hint="Connect once, then re-authorize when scopes change."

        col={1}

        row={1}

        colSpan={4}

        rowSpan={2}

        bodyClassName="min-h-0 overflow-hidden"

      >

        {!googleConnected ? (

          <SegmentedShell layout="row" className="mb-3 w-full sm:w-auto">

            <SegmentedOption

              selected={false}

              disabled={connectingGoogle}

              onSelect={() => void handleGoogleConnect()}

              label={connectingGoogle ? 'Connecting…' : 'Connect Google'}

            />

          </SegmentedShell>

        ) : null}

        {googleConnectError ? (

          <p className="mb-3 text-sm text-rose-300/90 font-secondary">{googleConnectError}</p>

        ) : null}

        {integrationsStatusQuery.isLoading ? (

          <p className="text-sm text-zinc-500 font-secondary">Loading integrations…</p>

        ) : integrationsStatusQuery.isError ? (

          <p className="text-sm text-rose-300/90 font-secondary">

            {fetchErr(integrationsStatusQuery.error)}

          </p>

        ) : (

          <div className="grid h-full min-h-0 auto-rows-fr grid-cols-2 gap-2 overflow-y-auto overscroll-none sm:grid-cols-3 lg:grid-cols-4">

            {integrationCards.map(integration => (

              <GoogleServiceCard

                key={integration.id}

                integration={integration}

                googleConnected={googleConnected}

                connectingGoogle={connectingGoogle}

                onReauth={() => void handleGoogleConnect()}

              />

            ))}

          </div>

        )}

      </GridTile>



      <GridTile

        title="Realtime data"

        hint="Always on — no account authorization."

        col={1}

        row={3}

        colSpan={4}

        rowSpan={2}

        bodyClassName="min-h-0"

      >

        <div className="grid h-full min-h-0 grid-cols-2 gap-2 lg:grid-cols-4">

          {REALTIME_DATA_SOURCES.map(source => (

            <article

              key={source.name}

              className="flex min-h-0 flex-col justify-between rounded-lg border border-white/8 bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-3"

            >

              <div className="flex items-start justify-between gap-2">

                <div className="flex min-w-0 items-center gap-2">

                  <source.Icon className="h-4 w-4 shrink-0 text-emerald-300/90" aria-hidden />

                  <p className="text-sm font-medium text-zinc-100">{source.name}</p>

                </div>

                <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300 font-secondary">

                  Always on

                </span>

              </div>

              <p className="mt-3 text-xs leading-relaxed text-zinc-500 font-secondary">

                {source.detail}

              </p>

            </article>

          ))}

        </div>

      </GridTile>

    </SettingsGrid4>

  );

}


