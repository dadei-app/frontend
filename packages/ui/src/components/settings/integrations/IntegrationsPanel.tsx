import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock3, CloudSun, Globe, Map as MapIcon } from 'lucide-react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { useTutorialContext } from '@dadei/ui/contexts/TutorialContext';
import { useNeedsTutorial } from '@dadei/ui/lib/query/queryHooks';
import { isSettingsTutorialStep } from '@dadei/ui/lib/tutorial/constants';
import { triggerGoogleOAuth } from '@dadei/ui/lib/auth/googleAuth';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { useIntegrationsStatusQuery } from '@dadei/ui/lib/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/assistantPaths';
import { GridTile, SettingsGrid4 } from '@dadei/ui/components/settings/layout';
import { SegmentedOption, SegmentedShell } from '@dadei/ui/components/settings/controls';
import { GOOGLE_LOGOS } from './integrationIcons';
import { IntegrationCard, type IntegrationStatusKind } from './IntegrationCard';

const GOOGLE_META: Record<string, { name: string; description: string }> = {
  gmail: { name: 'Gmail', description: 'Inbox & send' },
  calendar: { name: 'Calendar', description: 'Events & meetings' },
  contacts: { name: 'Contacts', description: 'People lookup' },
  tasks: { name: 'Tasks', description: 'To-do lists' },
  docs: { name: 'Docs', description: 'Docs read/write' },
  drive: { name: 'Drive', description: 'App files only' },
  sheets: { name: 'Sheets', description: 'Sheets & cells' },
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
    description:
      'Used when you ask about conditions, rain, temperature, or what to wear. Loads current conditions and short forecasts from Google Weather at coordinates—often paired with your location or a place from Maps.',
    Icon: CloudSun,
  },
  {
    name: 'Maps',
    description:
      'Used for place search, addresses, directions, travel time, and “near me” questions. Also resolves “where am I” and supplies coordinates when Weather needs a location.',
    Icon: MapIcon,
  },
  {
    name: 'Web Search',
    description:
      'Used when the answer needs fresh public information—news, facts, or topics not in Gmail, Drive, or memory. Queries DuckDuckGo for instant answers and related links (no Google account).',
    Icon: Globe,
  },
  {
    name: 'Current Time',
    description:
      'Used for “what time is it”, scheduling in your timezone, and sanity-checking meeting times. Reads your account timezone and IANA zones via Google’s timezone API—always on, no Workspace sign-in.',
    Icon: Clock3,
  },
] as const;

const integrationGridClass =
  'grid h-full min-h-0 w-full grid-cols-4 grid-rows-2 gap-3 [grid-auto-rows:1fr]';

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
  const { isElectron } = useSystem();
  const tutorial = useTutorialContext();
  const needsTutorial = useNeedsTutorial();
  const settingsTourActive = Boolean(
    needsTutorial && tutorial && isSettingsTutorialStep(tutorial.step.id),
  );
  const integrationsStatusQuery = useIntegrationsStatusQuery(!settingsTourActive);
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
        logo: GOOGLE_LOGOS[id],
      };
    });
  }, [integrationsStatus?.integrations]);

  const handleGoogleConnect = async () => {
    setGoogleConnectError('');
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
        bodyClassName="min-h-0 gap-3"
      >
        {!googleConnected ? (
          <SegmentedShell layout="row" className="w-full shrink-0 sm:w-auto">
            <SegmentedOption
              selected={false}
              disabled={connectingGoogle}
              onSelect={() => void handleGoogleConnect()}
              label={connectingGoogle ? 'Connecting…' : 'Connect Google'}
            />
          </SegmentedShell>
        ) : null}
        {googleConnectError ? (
          <p className="shrink-0 text-sm text-rose-300/90 font-secondary">{googleConnectError}</p>
        ) : null}
        {integrationsStatusQuery.isLoading ? (
          <p className="text-sm text-zinc-500 font-secondary">Loading integrations…</p>
        ) : integrationsStatusQuery.isError ? (
          <p className="text-sm text-rose-300/90 font-secondary">
            {fetchErr(integrationsStatusQuery.error)}
          </p>
        ) : (
          <div className={integrationGridClass}>
            {integrationCards.map(integration => (
              <IntegrationCard
                key={integration.id}
                name={integration.name}
                description={integration.description}
                logo={integration.logo}
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
        rowSpan={2}
        bodyClassName="min-h-0"
      >
        <div className={integrationGridClass}>
          {REALTIME_SOURCES.map(source => (
            <IntegrationCard
              key={source.name}
              className="row-span-2"
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
