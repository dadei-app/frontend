import type { CSSProperties } from 'react';
import { cn } from '@dadei/ui/lib/shared/cn';
import { DESKTOP_TITLEBAR_ATTR } from '@dadei/ui/contexts/SystemContext';
import {
  DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
  isElectronDesktop,
  isElectronMac,
} from '@dadei/ui/lib/platform/electronWindowChrome';

/**
 * Draggable title-bar region only (Electron custom-title-bar tutorial / WCO pattern).
 * Window min/max/close are native via titleBarOverlay (win/linux) or traffic lights (mac).
 */
export function DesktopTitleBarStrip() {
  if (!isElectronDesktop()) return null;

  return (
    <header
      {...{ [DESKTOP_TITLEBAR_ATTR]: '' }}
      className={cn(
        'flex w-full shrink-0 items-center border-b border-white/8 bg-zinc-950/90 backdrop-blur-md',
        'pr-[var(--desktop-titlebar-controls-width,env(titlebar-area-width,0px))]',
      )}
      style={
        {
          height: 'var(--assistant-titlebar-offset, env(titlebar-area-height, 2rem))',
          minHeight: DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
          WebkitAppRegion: 'drag',
          appRegion: 'drag',
        } as CSSProperties
      }
    >
      <span
        className={cn(
          'pointer-events-none mx-auto select-none font-semibold tracking-tight text-zinc-500 font-primary',
          isElectronMac() ? 'text-sm leading-none' : 'text-base',
        )}
      >
        dadei
      </span>
    </header>
  );
}
