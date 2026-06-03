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

function accessBadgeClass(granted: boolean, googleConnected: boolean): string {
  if (granted) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
  if (googleConnected) {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  }
  return 'border-zinc-700 bg-zinc-800/80 text-zinc-500';
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
    <div className="conic-border glass-panel space-y-6 rounded-lg p-5">
      <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm text-zinc-100">Google Workspace</h4>
            <p className="mt-1 text-xs text-zinc-500 font-secondary">
              Connect once, then re-authorize services when scopes change.
            </p>
          </div>
          {!googleConnected ? (
            <button
              type="button"
              onClick={() => void handleGoogleConnect()}
              disabled={connectingGoogle}
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-zinc-800/85 px-3 py-1.5 text-xs text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 emerald-glow"
            >
              {connectingGoogle ? 'Connecting…' : 'Connect Google'}
            </button>
          ) : null}
        </div>
        {googleConnectError ? (
          <p className="mt-3 text-xs text-rose-300/90 font-secondary">{googleConnectError}</p>
        ) : null}
        {integrationsStatusQuery.isLoading ? (
          <p className="mt-4 text-xs text-zinc-500 font-secondary">Loading integrations…</p>
        ) : integrationsStatusQuery.isError ? (
          <p className="mt-4 text-xs text-rose-300/90 font-secondary">
            {fetchErr(integrationsStatusQuery.error)}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {integrationCards.map(integration => {
            const isConnectedStatus = integration.status === 'connected';
            const isReauthStatus = integration.status === 'needs_reauth';
            return (
              <article
                key={integration.id}
                className="rounded-xl border border-white/8 bg-zinc-900/75 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <integration.Icon className="h-4 w-4 text-emerald-300/90" aria-hidden />
                    <p className="text-sm text-zinc-100">{integration.name}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-secondary ${
                      isConnectedStatus
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : isReauthStatus
                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                          : 'border-zinc-600/80 bg-zinc-800/80 text-zinc-400'
                    }`}
                  >
                    {isConnectedStatus
                      ? 'Connected'
                      : isReauthStatus
                        ? 'Needs re-auth'
                        : 'Disconnected'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {integration.access.map(badge => (
                    <span
                      key={`${integration.id}-${badge.kind}`}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium font-secondary ${accessBadgeClass(
                        badge.granted,
                        googleConnected,
                      )}`}
                    >
                      {badge.kind === 'read' ? 'Read' : 'Write'}
                    </span>
                  ))}
                </div>
                {isReauthStatus && googleConnected ? (
                  <button
                    type="button"
                    onClick={() => void handleGoogleConnect()}
                    disabled={connectingGoogle}
                    className="mt-3 inline-flex items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {connectingGoogle ? 'Re-authorizing…' : 'Re-authorize'}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-4">
        <h4 className="text-sm text-zinc-100">Realtime Data</h4>
        <p className="mt-1 text-xs text-zinc-500 font-secondary">
          Always available. These sources do not require account authorization.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {REALTIME_DATA_SOURCES.map(source => (
            <article key={source.name} className="rounded-xl border border-white/8 bg-zinc-900/75 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <source.Icon className="h-4 w-4 text-emerald-300/90" aria-hidden />
                  <p className="text-sm text-zinc-100">{source.name}</p>
                </div>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300 font-secondary">
                  Always on
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500 font-secondary">{source.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
