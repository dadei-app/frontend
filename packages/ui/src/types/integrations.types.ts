export type IntegrationStatus = 'connected' | 'needs_reauth' | 'disconnected';
export type AccessKind = 'read' | 'write';

export type IntegrationAccessBadge = {
  kind: AccessKind;
  granted: boolean;
};

export type IntegrationScopeStatus = {
  id: string;
  name: string;
  required_scopes: string[];
  granted_scopes: string[];
  missing_scopes: string[];
  access: IntegrationAccessBadge[];
  status: IntegrationStatus;
};

export type ProviderServiceStatus = {
  id: string;
  name: string;
  status: IntegrationStatus;
  read: boolean;
  write: boolean;
};

export type ProviderHealth = {
  provider: string;
  connected: boolean;
  needs_reauth: boolean;
  reauth_reason: string | null;
  account_identifier: string | null;
  services: ProviderServiceStatus[];
};

export type IntegrationsStatusResponse = {
  google_connected: boolean;
  google_scopes_stale: boolean;
  scope_labels: Record<string, string>;
  integrations: IntegrationScopeStatus[];
  providers: ProviderHealth[];
  providers_needing_reauth: string[];
};

export type PrimaryProviderName = 'google' | 'microsoft' | 'apple';

export type PrimaryProvidersPatch = {
  primary_mail_provider?: PrimaryProviderName | null;
  primary_calendar_provider?: PrimaryProviderName | null;
  primary_contacts_provider?: PrimaryProviderName | null;
};
