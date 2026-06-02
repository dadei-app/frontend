import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoginOverlay from '@dadei/ui/components/modals/LoginModal';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/assistantPaths';
import { DesktopTitleBarStrip } from '@dadei/ui/components/DesktopWindowChrome';
import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return false;
  if (path.startsWith('/login')) return false;
  return true;
}

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = useMemo(() => {
    const raw = searchParams.get('next');
    if (raw && isSafeInternalPath(raw)) return raw;
    return ASSISTANT_PATH;
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, nextPath]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex h-screen flex-col bg-zinc-950">
        {isElectronDesktop() ? <DesktopTitleBarStrip /> : null}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <i className="fas fa-microphone-alt text-6xl text-emerald-400/80 animate-pulse" />
            <p className="text-xl font-medium text-zinc-300 font-secondary">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LoginOverlay
      webOAuthNextPath={nextPath}
      onAuthenticated={() => navigate(nextPath, { replace: true })}
    />
  );
}
