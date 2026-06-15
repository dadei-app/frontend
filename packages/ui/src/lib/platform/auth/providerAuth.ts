import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/runtime/assistantPaths';

import { authApi } from '@dadei/ui/lib/workspace/api/auth';

import { DESKTOP_OAUTH_RETURN_ORIGIN } from '@dadei/ui/lib/platform/auth/desktopOAuth';

import {

  buildWebAppleOAuthLoginUrl,

  buildWebGoogleOAuthLoginUrl,

  buildWebMicrosoftOAuthLoginUrl,

} from '@dadei/ui/lib/platform/auth/webOAuthUrls';



export type OAuthProvider = 'google' | 'microsoft' | 'apple';



export type TriggerProviderOAuthOptions = {

  saveTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;

  onSuccess?: () => void;

  onError?: (msg: string) => void;

  webNextPath?: string;

  /** Login uses smart email linking; link attaches to the current session (settings connect). */

  mode?: 'login' | 'link';

};



function buildWebLoginUrl(

  provider: OAuthProvider,

  nextPath: string,

  spaOrigin?: string,

  linkToken?: string,

): string {

  const builder =

    provider === 'google'

      ? buildWebGoogleOAuthLoginUrl

      : provider === 'microsoft'

        ? buildWebMicrosoftOAuthLoginUrl

        : buildWebAppleOAuthLoginUrl;

  return builder(nextPath, spaOrigin, linkToken);

}



const PROVIDER_LABEL: Record<OAuthProvider, string> = {

  google: 'Google',

  microsoft: 'Microsoft',

  apple: 'Apple',

};



function oauthErrorMessage(params: {

  error?: string;

  error_description?: string;

}): string {

  return params.error_description || params.error || 'OAuth sign-in failed';

}



export async function triggerProviderOAuth(

  provider: OAuthProvider,

  options: TriggerProviderOAuthOptions,

): Promise<void> {
  if (provider === 'apple') {
    options.onError?.('Apple sign-in is coming soon.');
    return;
  }

  const nextPath = options.webNextPath ?? ASSISTANT_PATH;

  const isLink = options.mode === 'link';

  const linkToken = isLink ? await authApi.createOAuthLinkToken(provider) : undefined;

  const spaOrigin = window.electronAPI?.startOAuthFlow

    ? DESKTOP_OAUTH_RETURN_ORIGIN

    : window.location.origin;

  const loginUrl = buildWebLoginUrl(provider, nextPath, spaOrigin, linkToken);



  if (!window.electronAPI?.startOAuthFlow) {

    window.location.href = loginUrl;

    return;

  }



  const label = PROVIDER_LABEL[provider];

  try {

    const result = await window.electronAPI.startOAuthFlow(loginUrl);

    if (result.error) {

      throw new Error(oauthErrorMessage(result));

    }

    if (result.linked) {

      options.onSuccess?.();

      return;

    }

    if (!result.access_token || !result.refresh_token) {

      throw new Error('Missing tokens in OAuth callback');

    }

    await window.electronAPI.storeTokens(result.access_token, result.refresh_token);

    await options.saveTokens({

      accessToken: result.access_token,

      refreshToken: result.refresh_token,

    });

    options.onSuccess?.();

  } catch (err: unknown) {

    options.onError?.(err instanceof Error ? err.message : `${label} login failed`);

  }

}


