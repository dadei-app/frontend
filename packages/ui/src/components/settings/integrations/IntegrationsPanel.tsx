import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock3, CloudSun, Globe, Map as MapIcon, Unplug } from 'lucide-react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { useTutorialSettingsTourActive } from '@dadei/ui/contexts/TutorialContext';
import {
  triggerProviderOAuth,
  type OAuthProvider,
} from '@dadei/ui/lib/platform/auth/providerAuth';
import { getUserErrorMessage } from '@dadei/ui/lib/platform/errors/userMessage';
import { useAuthMeQuery, useIntegrationsStatusQuery } from '@dadei/ui/lib/platform/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';
import { settingsReturnPath } from '@dadei/ui/lib/platform/runtime/assistantPaths';
import { authApi } from '@dadei/ui/lib/workspace/api/auth';
import { serviceApi } from '@dadei/ui/lib/workspace/api/service';
import { GridTile, SettingsGrid4, type SettingsPanelProps } from '@dadei/ui/components/settings/layout';
import { GlassAlertModal } from '@dadei/ui/components/ui/GlassModal';
import type { ProviderHealth } from '@dadei/ui/types/integrations.types';
import type { UserMe } from '@dadei/ui/types/auth.types';
import { IntegrationCard } from './IntegrationCard';
import { PrimaryProviderSelector } from './PrimaryProviderSelector';
import { ProviderColumn } from './ProviderColumn';
import { ReconnectBanner } from './ReconnectBanner';

const REALTIME_SOURCES = [
  {
    name: 'Weather',
    description: 'Current conditions and short forecasts from Google Weather.',
    Icon: CloudSun,
  },
  {
    name: 'Maps',
    description: 'Place search, directions, travel time, and nearby lookups.',
    Icon: MapIcon,
  },
  {
    name: 'Web Search',
    description: 'Fresh public info from the web via Brave Search—no account needed.',
    Icon: Globe,
  },
  {
    name: 'Current Time',
    description: 'Your timezone and local time—always on, no sign-in.',
    Icon: Clock3,
  },
] as const;

const realtimeGridClass =
  'settings-integration-grid--realtime grid h-full min-h-0 w-full grid-cols-2 grid-rows-2 gap-2 lg:grid-cols-4 lg:gap-3 [grid-auto-rows:minmax(4rem,1fr)] lg:[grid-auto-rows:minmax(0,1fr)]';

type PrimaryDomain = 'mail' | 'calendar' | 'contacts';

const DOMAIN_SERVICE_IDS: Record<PrimaryDomain, string[]> = {
  mail: ['gmail', 'mail'],
  calendar: ['calendar'],
  contacts: ['contacts'],
};

function normalizeOAuthProvider(provider: string): OAuthProvider {
  if (provider === 'apple_caldav') return 'apple';
  return provider as OAuthProvider;
}

function connectedProvidersForDomain(
  providers: ProviderHealth[],
  domain: PrimaryDomain,
): string[] {
  const serviceIds = DOMAIN_SERVICE_IDS[domain];
  return providers
    .filter(
      p =>
        p.connected &&
        p.services.some(s => serviceIds.includes(s.id) && s.status === 'connected'),
    )
    .map(p => p.provider);
}

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
};

export function IntegrationsPanel({ pendingAction, onActionConsumed }: SettingsPanelProps) {
  const queryClient = useQueryClient();
  const { user: me, refreshUser, saveTokens } = useAuth();
  const { showToast } = useNotifications();
  const settingsTourActive = useTutorialSettingsTourActive();
  const integrationsStatusQuery = useIntegrationsStatusQuery();
  const authMeQuery = useAuthMeQuery(!settingsTourActive);
  const profile = authMeQuery.data ?? me;

  const [connectError, setConnectError] = useState('');
  const [connectingProvider, setConnectingProvider] = useState<OAuthProvider | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ProviderHealth | null>(null);
  const [savingDomain, setSavingDomain] = useState<PrimaryDomain | null>(null);

  const integrationsStatus = integrationsStatusQuery.data;
  const integrationsLoaded = integrationsStatusQuery.isSuccess && integrationsStatus != null;

  const providers = integrationsStatus?.providers ?? [];
  const connectedProviderCount = providers.filter(p => p.connected).length;
  const hasPassword = profile?.has_password === true;
  const networkEmail = profile?.email ?? '';

  const providersNeedingReauth = useMemo(() => {
    const fromStatus = integrationsStatus?.providers_needing_reauth;
    if (fromStatus && fromStatus.length > 0) return fromStatus;
    return profile?.providers_needing_reauth ?? [];
  }, [integrationsStatus?.providers_needing_reauth, profile?.providers_needing_reauth]);

  useEffect(() => {
    if (settingsTourActive) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.integrationsStatus });
  }, [queryClient, settingsTourActive]);

  const invalidateAfterAuth = () => {
    void refreshUser();
    void queryClient.invalidateQueries({ queryKey: queryKeys.integrationsStatus });
    void queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
  };

  useEffect(() => {
    if (!pendingAction?.startsWith('oauth-linked-')) return;
    const provider = pendingAction.slice('oauth-linked-'.length);
    showToast(`${PROVIDER_LABEL[provider] ?? provider} connected`, 'success');
    invalidateAfterAuth();
    onActionConsumed?.();
  }, [onActionConsumed, pendingAction, queryClient, refreshUser, showToast]);

  const handleProviderConnect = async (provider: string) => {
    const oauthProvider = normalizeOAuthProvider(provider);
    setConnectError('');
    setConnectingProvider(oauthProvider);
    try {
      await triggerProviderOAuth(oauthProvider, {
        saveTokens,
        onSuccess: invalidateAfterAuth,
        onError: msg => setConnectError(msg),
        webNextPath: settingsReturnPath('integrations'),
        mode: 'link',
      });
    } finally {
      setConnectingProvider(null);
    }
  };

  const handlePrimaryChange = async (domain: PrimaryDomain, provider: string | null) => {
    const field = `primary_${domain}_provider` as const;
    const previous = queryClient.getQueryData<UserMe>(queryKeys.authMe);

    if (previous) {
      queryClient.setQueryData<UserMe>(queryKeys.authMe, {
        ...previous,
        [field]: provider,
      });
    }

    setSavingDomain(domain);
    try {
      await serviceApi.updatePrimaryProviders({
        [field]: provider,
      } as Parameters<typeof serviceApi.updatePrimaryProviders>[0]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
    } catch (err: unknown) {
      if (previous) {
        queryClient.setQueryData<UserMe>(queryKeys.authMe, previous);
      }
      setConnectError(getUserErrorMessage(err, 'Could not update default account.'));
    } finally {
      setSavingDomain(null);
    }
  };

  const handleDisconnectConfirm = async () => {
    if (!disconnectTarget) return;
    const provider = disconnectTarget.provider;
    setDisconnectingProvider(provider);
    setConnectError('');
    try {
      await authApi.disconnectOAuthProvider(provider);
      invalidateAfterAuth();
      setDisconnectTarget(null);
    } catch (err: unknown) {
      setConnectError(getUserErrorMessage(err, 'Could not disconnect this account.'));
    } finally {
      setDisconnectingProvider(null);
    }
  };

  const fetchErr = (e: unknown) => getUserErrorMessage(e, 'Something went wrong. Please try again.');

  return (
    <SettingsGrid4 layout="integrations" className="min-h-0 flex-1">
      <GridTile
        tile="providers"
        title="Connected accounts"
        hint="Providers can use a different email than your network. Set a password in Account to remove your last sign-in method."
        bodyClassName="min-h-0 gap-4"
      >
        <ReconnectBanner
          providers={providersNeedingReauth}
          onReconnect={provider => void handleProviderConnect(provider)}
        />

        {connectError ? (
          <p className="shrink-0 text-sm text-rose-300/90 font-secondary">{connectError}</p>
        ) : null}

        {!integrationsLoaded && !integrationsStatusQuery.isError ? (
          <p className="text-sm text-zinc-500 font-secondary">Loading integrations…</p>
        ) : integrationsStatusQuery.isError ? (
          <p className="text-sm text-rose-300/90 font-secondary">
            {fetchErr(integrationsStatusQuery.error)}
          </p>
        ) : (
          <>
            <div className="grid min-h-0 w-full min-w-0 shrink-0 grid-cols-1 gap-3 lg:grid-cols-3">
              {providers.map(health => (
                <ProviderColumn
                  key={health.provider}
                  health={health}
                  networkEmail={networkEmail}
                  hasPassword={hasPassword}
                  connectedProviderCount={connectedProviderCount}
                  connecting={connectingProvider === normalizeOAuthProvider(health.provider)}
                  disconnecting={disconnectingProvider === health.provider}
                  disconnectPending={disconnectTarget?.provider === health.provider}
                  onConnect={() => void handleProviderConnect(health.provider)}
                  onDisconnect={() => setDisconnectTarget(health)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <PrimaryProviderSelector
                domain="mail"
                connectedProviders={connectedProvidersForDomain(providers, 'mail')}
                value={profile?.primary_mail_provider ?? null}
                saving={savingDomain === 'mail'}
                onChange={provider => void handlePrimaryChange('mail', provider)}
              />
              <PrimaryProviderSelector
                domain="calendar"
                connectedProviders={connectedProvidersForDomain(providers, 'calendar')}
                value={profile?.primary_calendar_provider ?? null}
                saving={savingDomain === 'calendar'}
                onChange={provider => void handlePrimaryChange('calendar', provider)}
              />
              <PrimaryProviderSelector
                domain="contacts"
                connectedProviders={connectedProvidersForDomain(providers, 'contacts')}
                value={profile?.primary_contacts_provider ?? null}
                saving={savingDomain === 'contacts'}
                onChange={provider => void handlePrimaryChange('contacts', provider)}
              />
            </div>
          </>
        )}
      </GridTile>

      <GlassAlertModal
        open={disconnectTarget != null}
        onOpenChange={open => {
          if (!open) setDisconnectTarget(null);
        }}
        variant="destructive"
        icon={Unplug}
        title={`Disconnect ${disconnectTarget ? (PROVIDER_LABEL[disconnectTarget.provider] ?? disconnectTarget.provider) : ''}?`}
        description={
          disconnectTarget?.account_identifier
            ? `This removes ${disconnectTarget.account_identifier} from your network. You can reconnect anytime from Connected accounts.`
            : 'This removes the provider from your network. You can reconnect anytime from Connected accounts.'
        }
        confirmLabel="Disconnect"
        confirmingLabel="Disconnecting…"
        confirming={disconnectingProvider != null}
        onConfirm={() => void handleDisconnectConfirm()}
      />

      <GridTile
        tile="realtime"
        title="Realtime data"
        hint="Always on — no account authorization."
        bodyClassName="min-h-0"
      >
        <div className={realtimeGridClass}>
          {REALTIME_SOURCES.map(source => (
            <IntegrationCard
              key={source.name}
              className="integration-card--realtime"
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
