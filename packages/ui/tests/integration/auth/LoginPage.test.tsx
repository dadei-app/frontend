import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '@dadei/ui/pages/LoginPage';

const mockTriggerProviderOAuth = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@dadei/ui/lib/platform/auth/providerAuth', () => ({
  triggerProviderOAuth: (...args: unknown[]) => mockTriggerProviderOAuth(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@dadei/ui/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    saveTokens: vi.fn(),
  }),
}));

vi.mock('@dadei/ui/contexts/SystemContext', () => ({
  useSystem: () => ({
    isElectron: false,
    viewportFillClass: 'min-h-screen',
  }),
}));

function renderLoginPage(next = '/assistant') {
  return render(
    <MemoryRouter initialEntries={[`/login?next=${encodeURIComponent(next)}`]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTriggerProviderOAuth.mockResolvedValue(undefined);
  });

  it('shows the email form by default and reveals providers via the link', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue with a provider/i }));

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('renders three provider buttons when provider view is open', () => {
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with a provider/i }));

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeDisabled();
  });

  it('does not invoke OAuth for Apple while coming soon', () => {
    renderLoginPage('/memories');

    fireEvent.click(screen.getByRole('button', { name: /continue with a provider/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with apple/i }));

    expect(mockTriggerProviderOAuth).not.toHaveBeenCalled();
  });
});
