import type { ReactNode } from 'react';
import { DesktopTitleBarStrip } from '@dadei/ui/components/TitleBar';
import { isElectronDesktop } from '@dadei/ui/lib/platform/electronWindowChrome';

/**
 * Electron: slim drag strip (OS window controls via titleBarOverlay) + product client area.
 * Web: children only.
 */
export function DesktopAppShell({ children }: { children: ReactNode }) {
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
