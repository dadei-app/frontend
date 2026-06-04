import { useLayoutEffect, type ReactNode } from 'react';
import { DesktopTitleBarStrip } from '@dadei/ui/components/TitleBar';
import {
  DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
  isElectronDesktop,
} from '@dadei/ui/lib/platform/electronWindowChrome';

/**
 * Frameless Electron chrome: one title bar for the whole renderer (all routes, modals, loading).
 * Web builds render children only.
 */
export function DesktopAppShell({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    if (!isElectronDesktop()) return;
    document.documentElement.style.setProperty(
      '--assistant-titlebar-offset',
      DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
    );
    return () => {
      document.documentElement.style.removeProperty('--assistant-titlebar-offset');
    };
  }, []);

  if (!isElectronDesktop()) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-950">
      <DesktopTitleBarStrip />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
