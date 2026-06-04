import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { cn } from '@dadei/ui/lib/shared/cn';
import {
  DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
  isElectronDesktop,
  isElectronMac,
  needsCustomWindowControls,
} from '@dadei/ui/lib/platform/electronWindowChrome';

function useMaximizedState() {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!api?.windowIsMaximized || !api.onWindowMaximizedChanged) return;
    let cancelled = false;
    void api.windowIsMaximized().then((v) => {
      if (!cancelled) setIsMaximized(v);
    });
    const off = api.onWindowMaximizedChanged(setIsMaximized);
    return () => {
      cancelled = true;
      off();
    };
  }, [api]);

  return { api, isMaximized, setIsMaximized };
}

/** Window controls for frameless desktop Electron (all platforms). */
export function DesktopWindowControls() {
  const { api, isMaximized, setIsMaximized } = useMaximizedState();

  const minimize = useCallback(() => {
    void api?.windowMinimize?.();
  }, [api]);

  const toggleMax = useCallback(() => {
    if (!api?.windowToggleMaximize) return;
    void api.windowToggleMaximize().then(setIsMaximized);
  }, [api, setIsMaximized]);

  const close = useCallback(() => {
    void api?.windowClose?.();
  }, [api]);

  if (!needsCustomWindowControls() || !api?.windowMinimize) {
    return null;
  }

  const btn =
    'flex h-full w-10 items-center justify-center text-zinc-400 transition-colors hover:bg-white/8 hover:text-zinc-100 active:bg-white/12';

  return (
    <div
      className="flex self-stretch border-l border-white/8"
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
    >
      <button type="button" onClick={minimize} className={btn} title="Minimize" aria-label="Minimize">
        <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <button type="button" onClick={toggleMax} className={btn} title={isMaximized ? 'Restore' : 'Maximize'} aria-label={isMaximized ? 'Restore' : 'Maximize'}>
        {isMaximized ? <Copy className="h-3.5 w-3.5" strokeWidth={2} /> : <Square className="h-3 w-3" strokeWidth={2.25} />}
      </button>
      <button
        type="button"
        onClick={close}
        className={cn(
          btn,
          'w-11 hover:bg-rose-600 hover:text-white active:bg-rose-700',
        )}
        title="Close"
        aria-label="Close"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

/** Slim top bar: drag + branding; custom window controls only on Windows / Linux. */
export function DesktopTitleBarStrip() {
  if (!isElectronDesktop()) return null;

  return (
    <div
      className="relative z-50 flex w-full shrink-0 border-b border-white/8 bg-zinc-950/90 backdrop-blur-md items-center"
      style={
        {
          height: DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
          minHeight: DESKTOP_TITLEBAR_STRIP_HEIGHT_CSS,
          WebkitAppRegion: 'drag',
        } as CSSProperties
      }
    >
      <span
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none font-semibold tracking-tight text-zinc-500 font-primary',
          isElectronMac() ? 'text-sm leading-none' : 'text-base',
        )}
      >
        dadei
      </span>
      {needsCustomWindowControls() ? (
        <div className="relative z-10 ml-auto flex self-stretch">
          <DesktopWindowControls />
        </div>
      ) : null}
    </div>
  );
}
