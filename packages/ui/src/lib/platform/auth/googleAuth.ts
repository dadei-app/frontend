import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/runtime/assistantPaths';
import { authApi } from '@dadei/ui/lib/workspace/api/auth';
import { buildWebGoogleOAuthLoginUrl } from '@dadei/ui/lib/platform/auth/webOAuthUrls';

export async function triggerGoogleOAuth(options: {
  saveTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
  webNextPath?: string;
}): Promise<void> {
  if (!window.electronAPI) {
    window.location.href = buildWebGoogleOAuthLoginUrl(
      options.webNextPath ?? ASSISTANT_PATH,
      window.location.origin
    );
    return;
  }

  try {
    const result = await window.electronAPI.loginWithGoogle();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Google OAuth failed');
    }

    const { code, state } = result.data;
    const response = await authApi.googleCallback(code, state);
    await window.electronAPI.storeTokens(response.access_token, response.refresh_token);
    await options.saveTokens({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    });
    options.onSuccess?.();
  } catch (err: unknown) {
    options.onError?.(err instanceof Error ? err.message : 'Google login failed');
  }
}
