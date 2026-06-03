import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { BootstrapStatePayload } from '@dadei/ui/types/electron';

interface BootstrapContextValue {
  state: BootstrapStatePayload;
  isReady: boolean;
}

const BootstrapContext = createContext<BootstrapContextValue | undefined>(undefined);

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const [state, setState] = useState<BootstrapStatePayload>({
    phase: isElectron ? 'booting' : 'ready',
  });

  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onBootstrapState) return;
    const off = window.electronAPI.onBootstrapState((payload) => {
      setState(payload);
    });
    return off;
  }, [isElectron]);

  return (
    <BootstrapContext.Provider value={{ state, isReady: state.phase === 'ready' }}>
      {children}
    </BootstrapContext.Provider>
  );
}

export function useBootstrap() {
  const ctx = useContext(BootstrapContext);
  if (!ctx) throw new Error('useBootstrap must be used within BootstrapProvider');
  return ctx;
}
