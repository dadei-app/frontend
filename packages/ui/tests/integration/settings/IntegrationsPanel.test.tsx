import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntegrationsPanel } from '@dadei/ui/components/settings/integrations/IntegrationsPanel';

vi.mock('@dadei/ui/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      primary_mail_provider: null,
      primary_calendar_provider: null,
      primary_contacts_provider: null,
      providers_needing_reauth: [],
    },
    refreshUser: vi.fn(),
    saveTokens: vi.fn(),
  }),
}));

vi.mock('@dadei/ui/contexts/SystemContext', () => ({
  useSystem: () => ({ isElectron: false }),
}));

vi.mock('@dadei/ui/contexts/TutorialContext', () => ({
  useTutorialSettingsTourActive: () => false,
}));

vi.mock('@dadei/ui/lib/platform/query/queryHooks', () => ({
  useIntegrationsStatusQuery: () => ({
    isSuccess: true,
    isError: false,
    data: {
      providers: [
        {
          provider: 'google',
          connected: false,
          needs_reauth: false,
          reauth_reason: null,
          services: [],
        },
        {
          provider: 'microsoft',
          connected: false,
          needs_reauth: false,
          reauth_reason: null,
          services: [],
        },
        {
          provider: 'apple',
          connected: false,
          needs_reauth: false,
          reauth_reason: null,
          services: [],
        },
      ],
      providers_needing_reauth: [],
    },
  }),
  useAuthMeQuery: () => ({
    data: {
      primary_mail_provider: null,
      primary_calendar_provider: null,
      primary_contacts_provider: null,
      providers_needing_reauth: [],
    },
  }),
}));

describe('IntegrationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('still renders the realtime sources block unchanged', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <IntegrationsPanel />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Realtime data')).toBeInTheDocument();
    expect(screen.getByText('Weather')).toBeInTheDocument();
    expect(screen.getByText('Maps')).toBeInTheDocument();
    expect(screen.getByText('Web Search')).toBeInTheDocument();
    expect(screen.getByText('Current Time')).toBeInTheDocument();
  });
});
