import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { resolvePostOAuthPath } from '@dadei/ui/lib/platform/assistantPaths';

/**
 * Handles redirect return from server-side web OAuth.
 * Expects `access_token`, `refresh_token` (snake_case) and optional `next` path.
 * On `error` / `error_description`, shows a message and routes to login.
 */
export default function AuthOAuthCallbackPage() {
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
    (async () => {
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <p className="text-center text-sm text-slate-600">{message}</p>
    </div>
  );
}
