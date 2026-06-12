import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import {
  isRequiredPermission,
  permissionsForPlatform,
  toTutorialPlatform,
  type PermissionEntry,
} from '@dadei/ui/lib/tutorial/permissionsRegistry';
import { cn } from '@dadei/ui/lib/shared/cn';

type PermissionUiStatus = 'idle' | 'pending' | 'granted' | 'denied';

export function PermissionsPrompt({
  onRequiredGrantedChange,
}: {
  onRequiredGrantedChange: (granted: boolean) => void;
}) {
  const { isElectron, platform } = useSystem();
  const tutorialPlatform = toTutorialPlatform(platform, isElectron);
  const entries = useMemo(
    () => permissionsForPlatform(tutorialPlatform, isElectron),
    [tutorialPlatform, isElectron],
  );
  const [statusById, setStatusById] = useState<Record<string, PermissionUiStatus>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, PermissionUiStatus> = {};
      await Promise.all(
        entries.map(async entry => {
          const result = await entry.check();
          if (result === 'granted') next[entry.id] = 'granted';
          else if (result === 'denied') next[entry.id] = 'denied';
        }),
      );
      if (!cancelled) {
        setStatusById(prev => ({ ...next, ...prev }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const requiredGranted = entries
    .filter(isRequiredPermission)
    .every(entry => statusById[entry.id] === 'granted');

  useEffect(() => {
    onRequiredGrantedChange(requiredGranted);
  }, [requiredGranted, onRequiredGrantedChange]);

  const handleAllow = useCallback(async (entry: PermissionEntry) => {
    setStatusById(prev => ({ ...prev, [entry.id]: 'pending' }));
    await entry.request();
    const recheck = await entry.check();
    const granted = recheck === 'granted';
    setStatusById(prev => ({
      ...prev,
      [entry.id]: granted ? 'granted' : 'denied',
    }));
  }, []);

  const grantedCount = entries.filter(entry => statusById[entry.id] === 'granted').length;

  return (
    <div className="max-h-[min(70vh,28rem)] overflow-y-auto [scrollbar-width:thin]">
      <p className="text-sm text-zinc-400 font-secondary">
        Microphone access is required to listen and respond. Other permissions are optional — you
        can turn them on later in Settings.
      </p>
      {entries.length > 0 ? (
        <p className="mt-1 text-xs text-zinc-600 font-secondary">
          {grantedCount} of {entries.length} allowed
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {entries.map(entry => {
          const status = statusById[entry.id] ?? 'idle';
          const required = isRequiredPermission(entry);
          const label =
            status === 'pending' ? '…' : status === 'granted' ? 'Allowed' : 'Allow';

          return (
            <li
              key={entry.id}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-zinc-100">
                  {entry.label}
                  {required ? (
                    <span className="ml-1.5 text-xs font-normal text-emerald-400/90">Required</span>
                  ) : null}
                </p>
                <p className="text-xs text-zinc-500 font-secondary">{entry.description}</p>
              </div>
              <button
                type="button"
                disabled={status === 'pending' || status === 'granted'}
                className={cn(
                  'shrink-0 min-w-[5.5rem] rounded-lg border px-3 py-1.5 text-sm transition',
                  status === 'granted' &&
                    'cursor-default border-white/8 bg-zinc-800/80 text-zinc-500',
                  status === 'pending' &&
                    'cursor-wait border-white/10 bg-zinc-800/60 text-zinc-500',
                  (status === 'idle' || status === 'denied') &&
                    'border-emerald-500/30 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50',
                )}
                onClick={() => {
                  void handleAllow(entry);
                }}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
