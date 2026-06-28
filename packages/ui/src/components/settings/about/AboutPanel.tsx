import { useCallback, useEffect, useState } from 'react';
import { logoUrl } from '@dadei/ui/assets/brand';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import type { UpdaterCheckResult } from '@dadei/ui/types/electron';
import {
  SettingsBento,
  settingsPrimaryButtonClass,
  type SettingsPanelProps,
} from '@dadei/ui/components/settings/layout';

function openExternal(url: string) {
  if (window.electronAPI?.openExternal) {
    void window.electronAPI.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function UpdateCheckResultDisplay({ result }: { result: UpdaterCheckResult }) {
  if (result.status === 'up_to_date') {
    return <p className="text-base text-emerald-300/90">You&apos;re on the latest version.</p>;
  }
  if (result.status === 'update_available') {
    return (
      <p className="text-base text-zinc-300">
        Version {result.version} is available
        {result.downloadUrl ? (
          <>
            .{' '}
            <button
              type="button"
              onClick={() => openExternal(result.downloadUrl!)}
              className="text-emerald-400 underline hover:text-emerald-300"
            >
              Download
            </button>
          </>
        ) : (
          ' and will download when the updater runs.'
        )}
      </p>
    );
  }
  if (result.status === 'manual_required') {
    return (
      <div className="space-y-3">
        <p className="text-base text-zinc-300">
          Version {result.version ?? 'newer'} is available.
        </p>
        {result.downloadUrl ? (
          <button
            type="button"
            onClick={() => openExternal(result.downloadUrl!)}
            className={settingsPrimaryButtonClass}
          >
            Open download page
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <p className="text-base text-rose-300/90">
      Couldn&apos;t check for updates{result.error ? `: ${result.error}` : '.'}
    </p>
  );
}

export function AboutPanel({ pendingAction, onActionConsumed }: SettingsPanelProps) {
  const { appVersion, appBuildHash, bootstrapState } = useSystem();
  const version = appVersion ?? bootstrapState.appVersion ?? '—';
  const buildHash = appBuildHash;
  const [checkResult, setCheckResult] = useState<UpdaterCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = useCallback(async () => {
    if (!window.electronAPI?.updaterManualCheck) {
      setCheckResult({ status: 'up_to_date', version: version || 'web' });
      return;
    }
    setChecking(true);
    try {
      const result = await window.electronAPI.updaterManualCheck();
      setCheckResult(result);
    } finally {
      setChecking(false);
    }
  }, [version]);

  useEffect(() => {
    if (pendingAction === 'check-updates') {
      void handleCheck();
      onActionConsumed?.();
    }
  }, [pendingAction, handleCheck, onActionConsumed]);

  return (
    <SettingsBento centered>
      <div className="flex flex-col items-center gap-4">
        <img
          src={logoUrl}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 shrink-0 rounded-lg"
          aria-hidden
        />
        <span className="font-brand text-4xl tracking-wider text-zinc-100">dadei</span>
      </div>
      <div>
        <p className="text-base text-zinc-500 font-secondary">
          Version {version || '—'}
          {buildHash ? ` · ${buildHash.slice(0, 7)}` : ''}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleCheck()}
        disabled={checking}
        className={`${settingsPrimaryButtonClass} disabled:opacity-50`}
      >
        {checking ? 'Checking…' : 'Check for updates'}
      </button>

      {checkResult ? <UpdateCheckResultDisplay result={checkResult} /> : null}

      <div className="flex flex-wrap justify-center gap-8 border-t border-white/5 pt-8 text-sm text-zinc-500">
        <a href="https://dadei.app/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
          Privacy
        </a>
        <a href="https://dadei.app/terms" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
          Terms
        </a>
        <a href="https://dadei.app/support" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
          Support
        </a>
      </div>
    </SettingsBento>
  );
}
