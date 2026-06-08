import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { resolvePostOAuthPath } from '@dadei/ui/lib/platform/assistantPaths';

/**
 * Web OAuth return handler — not a user-facing page.
 * The API redirects here with tokens (or errors) in the query string after Google sign-in.
 * Desktop uses main-process IPC OAuth instead and does not mount this route.
 */
export default function OAuthCallback() {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <p className="text-center text-sm text-zinc-400 font-secondary">{message}</p>
    </div>
  );
}
