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

export type IntegrationsStatusResponse = {
  google_connected: boolean;
  google_scopes_stale: boolean;
  scope_labels: Record<string, string>;
  integrations: IntegrationScopeStatus[];
};
