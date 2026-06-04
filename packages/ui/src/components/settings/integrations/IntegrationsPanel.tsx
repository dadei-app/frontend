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
  Map as MapIcon,
  Plug,
  Table,
  Users,
} from 'lucide-react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { triggerGoogleOAuth } from '@dadei/ui/lib/auth/googleAuth';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { useIntegrationsStatusQuery } from '@dadei/ui/lib/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/assistantPaths';
import { GridTile, SettingsGrid4 } from '@dadei/ui/components/settings/layout';
import { SegmentedOption, SegmentedShell } from '@dadei/ui/components/settings/controls';
import { IntegrationCard, type IntegrationStatusKind } from './IntegrationCard';

const INTEGRATION_ICONS: Record<string, typeof CalendarDays> = {
  gmail: Mail,
  calendar: CalendarDays,
  contacts: Users,
  tasks: CheckSquare,
  docs: FileText,
  drive: HardDrive,
  sheets: Table,
};

const GOOGLE_META: Record<
  string,
  { name: string; description: string }
> = {
  gmail: {
    name: 'Gmail',
    description: 'Read threads and send mail on your behalf.',
  },
  calendar: {
    name: 'Calendar',
    description: 'View events and schedule meetings.',
  },
  contacts: {
    name: 'Contacts',
    description: 'Look up people and keep context accurate.',
  },
  tasks: {
    name: 'Tasks',
    description: 'Track to-dos and mark items complete.',
  },
  docs: {
    name: 'Docs',
    description: 'Create and update Google documents.',
  },
  drive: {
    name: 'Drive',
    description: 'Files created or opened through Dadei.',
  },
  sheets: {
    name: 'Sheets',
    description: 'Read and update spreadsheets.',
  },
};

/** Seven Workspace APIs we request OAuth scopes for. */
const GOOGLE_INTEGRATION_ORDER = [
  'gmail',
  'calendar',
  'contacts',
  'tasks',
  'docs',
  'drive',
  'sheets',
] as const;

const REALTIME_SOURCES = [
  {
    name: 'Weather',
    description: 'Live conditions and short-term forecast lookups.',
    Icon: CloudSun,
  },
  {
    name: 'Maps',
    description: 'Place and routing lookups for local context.',
    Icon: MapIcon,
  },
  {
    name: 'Web Search',
    description: 'Fresh web answers and source retrieval.',
    Icon: Globe,
  },
  {
    name: 'Current Time',
    description: 'Timezone-aware clock checks without extra auth.',
    Icon: Clock3,
  },
] as const;

function googleStatus(
  status: string,
  googleConnected: boolean,
): IntegrationStatusKind {
  if (!googleConnected) return 'off';
  if (status === 'connected') return 'on';
  if (status === 'needs_reauth') return 'reauth';
  return 'off';
}

export function IntegrationsPanel() {
  const queryClient = useQueryClient();
  const { user: me, refreshUser, saveTokens } = useAuth();
  const integrationsStatusQuery = useIntegrationsStatusQuery(true);
  const [googleConnectError, setGoogleConnectError] = useState('');
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const integrationsStatus = integrationsStatusQuery.data;
  const googleConnected =
    integrationsStatus?.google_connected ?? Boolean(me?.google_connected);

  const integrationCards = useMemo(() => {
    const byId = new Map(
      (integrationsStatus?.integrations ?? []).map(i => [i.id, i]),
    );
    return GOOGLE_INTEGRATION_ORDER.map(id => {
      const row = byId.get(id);
      const meta = GOOGLE_META[id];
      const accessList = row?.access ?? [
        { kind: 'read', granted: false },
        { kind: 'write', granted: false },
      ];
      return {
        id,
        name: row?.name ?? meta.name,
        description: meta.description,
        status: row?.status ?? 'disconnected',
        read: accessList.find(a => a.kind === 'read')?.granted ?? false,
        write: accessList.find(a => a.kind === 'write')?.granted ?? false,
        Icon: INTEGRATION_ICONS[id] ?? Plug,
      };
    });
  }, [integrationsStatus?.integrations]);

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
          <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-2.5 overflow-hidden">
            {integrationCards.map(integration => (
              <IntegrationCard
                key={integration.id}
                name={integration.name}
                description={integration.description}
                Icon={integration.Icon}
                status={googleStatus(integration.status, googleConnected)}
                access={{
                  read: integration.read,
                  write: integration.write,
                  muted: !googleConnected,
                }}
                onReauth={
                  integration.status === 'needs_reauth' && googleConnected
                    ? () => void handleGoogleConnect()
                    : undefined
                }
                reauthLoading={connectingGoogle}
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
        rowSpan={1}
        bodyClassName="min-h-0 justify-start"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REALTIME_SOURCES.map(source => (
            <IntegrationCard
              key={source.name}
              name={source.name}
              description={source.description}
              Icon={source.Icon}
              status="live"
              variant="realtime"
            />
          ))}
        </div>
      </GridTile>
    </SettingsGrid4>
  );
}
