import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loading } from '@dadei/ui/components/Loading';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { resolvePostOAuthPath, OAUTH_LINKED_QUERY } from '@dadei/ui/lib/platform/runtime/assistantPaths';

/**
 * Web OAuth return handler — not a user-facing page.
 * The API redirects here with tokens (login) or `linked` (settings connect) in the query string.
 * Desktop Electron uses the `dadei://oauth/callback` custom protocol instead and does not mount this route.
 */
export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { saveTokens } = useAuth();
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    const err = searchParams.get('error') || searchParams.get('error_description');
    if (err) {
      setMessage(err);
      const t = setTimeout(() => navigate('/login', { replace: true }), 2500);
      return () => clearTimeout(t);
    }

    const linked = searchParams.get('linked');
    if (linked) {
      setMessage('Account connected…');
      const dest = resolvePostOAuthPath(searchParams.get('next'));
      const returnUrl = new URL(dest, window.location.origin);
      returnUrl.searchParams.set(OAUTH_LINKED_QUERY, linked);
      navigate(`${returnUrl.pathname}${returnUrl.search}`, { replace: true });
      return;
    }

    const access =
      searchParams.get('access_token') || searchParams.get('accessToken');
    const refresh =
      searchParams.get('refresh_token') || searchParams.get('refreshToken');

    if (!access || !refresh) {
      setMessage('Missing tokens in callback URL.');
      const t = setTimeout(() => navigate('/login', { replace: true }), 2500);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    void (async () => {
      try {
        await saveTokens({ accessToken: access, refreshToken: refresh });
        if (cancelled) return;
        navigate(resolvePostOAuthPath(searchParams.get('next')), { replace: true });
      } catch {
        if (cancelled) return;
        setMessage('Could not save session.');
        setTimeout(() => navigate('/login', { replace: true }), 2500);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, saveTokens, searchParams]);

  return <Loading visible subtitleOverride={message} />;
}

export default OAuthCallback;
