// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_OAUTH_RETURN_ORIGIN } from '@dadei/ui/lib/platform/auth/desktopOAuth';
import { triggerProviderOAuth } from '@dadei/ui/lib/platform/auth/providerAuth';
import { authApi } from '@dadei/ui/lib/workspace/api/auth';

vi.mock('@dadei/ui/lib/workspace/api/auth', () => ({
  authApi: {
    createOAuthLinkToken: vi.fn().mockResolvedValue('link-token-test'),
  },
}));

describe('triggerProviderOAuth', () => {
  const saveTokens = vi.fn();
  const onSuccess = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    saveTokens.mockResolvedValue(undefined);
    delete (window as { electronAPI?: unknown }).electronAPI;
    Object.defineProperty(window, 'location', {
      value: { href: '', origin: 'https://app.dadei.test' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as { electronAPI?: unknown }).electronAPI;
  });

  it('redirects to the google web login url on web', async () => {
    await triggerProviderOAuth('google', {
      saveTokens,
      webNextPath: '/assistant',
    });

    expect(window.location.href).toContain('/auth/google/web/login');
    expect(window.location.href).toContain('next=%2Fassistant');
    expect(window.location.href).toContain('spa_origin=https%3A%2F%2Fapp.dadei.test');
  });

  it('redirects to the microsoft web login url on web', async () => {
    await triggerProviderOAuth('microsoft', {
      saveTokens,
      webNextPath: '/memories',
    });

    expect(window.location.href).toContain('/auth/microsoft/web/login');
    expect(window.location.href).toContain('next=%2Fmemories');
  });

  it('redirects to the apple web login url on web', async () => {
    await triggerProviderOAuth('apple', {
      saveTokens,
      webNextPath: '/assistant',
    });

    expect(window.location.href).toContain('/auth/apple/web/login');
  });

  it('uses unified electron oauth flow for google login', async () => {
    const startOAuthFlow = vi.fn().mockResolvedValue({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
    });
    const storeTokens = vi.fn().mockResolvedValue({ success: true });

    window.electronAPI = {
      startOAuthFlow,
      storeTokens,
      openExternal: vi.fn(),
    } as unknown as Window['electronAPI'];

    await triggerProviderOAuth('google', { saveTokens, onSuccess, onError });

    expect(startOAuthFlow).toHaveBeenCalledWith(
      expect.stringContaining('/auth/google/web/login'),
    );
    expect(startOAuthFlow.mock.calls[0][0]).toContain(
      `spa_origin=${encodeURIComponent(DESKTOP_OAUTH_RETURN_ORIGIN)}`,
    );
    expect(storeTokens).toHaveBeenCalledWith('access-1', 'refresh-1');
    expect(saveTokens).toHaveBeenCalledWith({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('includes link_token in web url when mode is link', async () => {
    await triggerProviderOAuth('microsoft', {
      saveTokens,
      mode: 'link',
    });

    expect(authApi.createOAuthLinkToken).toHaveBeenCalledWith('microsoft');
    expect(window.location.href).toContain('link_token=link-token-test');
  });

  it('completes link mode on electron when callback returns linked', async () => {
    const startOAuthFlow = vi.fn().mockResolvedValue({ linked: 'google' });

    window.electronAPI = {
      startOAuthFlow,
      storeTokens: vi.fn(),
      openExternal: vi.fn(),
    } as unknown as Window['electronAPI'];

    await triggerProviderOAuth('google', { saveTokens, onSuccess, mode: 'link' });

    expect(startOAuthFlow).toHaveBeenCalled();
    expect(saveTokens).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('opens microsoft login via startOAuthFlow on electron', async () => {
    const startOAuthFlow = vi.fn().mockResolvedValue({
      access_token: 'access-ms',
      refresh_token: 'refresh-ms',
    });
    const storeTokens = vi.fn().mockResolvedValue({ success: true });

    window.electronAPI = {
      startOAuthFlow,
      storeTokens,
      openExternal: vi.fn(),
    } as unknown as Window['electronAPI'];

    await triggerProviderOAuth('microsoft', { saveTokens, onError });

    expect(startOAuthFlow).toHaveBeenCalledWith(
      expect.stringContaining('/auth/microsoft/web/login'),
    );
    expect(storeTokens).toHaveBeenCalledWith('access-ms', 'refresh-ms');
    expect(saveTokens).toHaveBeenCalled();
  });
});
