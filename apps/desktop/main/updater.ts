import { app, BrowserWindow, dialog } from 'electron';
import axios from 'axios';
import { autoUpdater } from 'electron-updater';
import type { BootstrapStatePayload } from './bootstrap-types';

const ROOT_TIMEOUT_MS = 10_000;
const GITHUB_RELEASES = 'https://github.com/dadei-app/frontend/releases';

interface RootHealthResponse {
  version: string;
  status: string;
}

function apiBaseUrl(): string {
  return (process.env.API_URL || 'http://localhost:8000').replace(/\/+$/, '');
}

export function semverMajor(version: string): number | null {
  const match = /^(\d+)/.exec(version.trim());
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

function semverParts(v: string): number[] {
  const core = v.trim().split('-')[0]?.split('+')[0] ?? '';
  return core.split('.').map((x) => {
    const n = parseInt(/^\d+/.exec(x)?.[0] ?? '0', 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** Lexicographic semver compare for `x.y.z` style versions. */
export function compareSemver(a: string, b: string): number {
  const pa = semverParts(a);
  const pb = semverParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

let lastBootstrapState: BootstrapStatePayload = { phase: 'booting' };

export function emitBootstrapState(payload: BootstrapStatePayload): void {
  lastBootstrapState = payload;
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:bootstrap-state', payload);
  }
}

/** Re-send the latest bootstrap payload after the renderer loads. */
export function replayBootstrapState(): void {
  emitBootstrapState(lastBootstrapState);
}

function isMacUnsigned(): boolean {
  if (process.platform !== 'darwin') return false;
  return !process.env.MAC_SIGNED;
}

export interface BackendVersionGate {
  allowLaunch: boolean;
  backendMajor: number | null;
  appMajor: number | null;
  serverVersion: string | null;
  mandatoryMismatch: boolean;
}

/**
 * GET {API_URL}/ — unreachable or bad payload: allow launch (same as legacy gate).
 * Major mismatch: mandatoryMismatch true, do not open main UI until updated.
 */
export async function getBackendVersionGate(): Promise<BackendVersionGate> {
  const url = `${apiBaseUrl()}/`;
  const appMajor = semverMajor(app.getVersion());

  try {
    const { data } = await axios.get<RootHealthResponse>(url, {
      timeout: ROOT_TIMEOUT_MS,
      validateStatus: (s) => s === 200,
    });

    if (!data || typeof data.version !== 'string') {
      console.warn('[version] Root health response missing version; continuing.');
      return {
        allowLaunch: true,
        backendMajor: null,
        appMajor,
        serverVersion: null,
        mandatoryMismatch: false,
      };
    }

    const backendMajor = semverMajor(data.version);
    if (backendMajor === null || appMajor === null) {
      console.warn('[version] Could not parse major version; continuing.');
      return {
        allowLaunch: true,
        backendMajor,
        appMajor,
        serverVersion: data.version.trim(),
        mandatoryMismatch: false,
      };
    }

    const mandatoryMismatch = backendMajor !== appMajor;
    return {
      allowLaunch: !mandatoryMismatch,
      backendMajor,
      appMajor,
      serverVersion: data.version.trim(),
      mandatoryMismatch,
    };
  } catch (e) {
    console.warn('[version] Backend root check failed; continuing without compatibility gate.', e);
    return {
      allowLaunch: true,
      backendMajor: null,
      appMajor,
      serverVersion: null,
      mandatoryMismatch: false,
    };
  }
}

let registered = false;
let postLaunchOptionalUpdatesEnabled = false;
let suppressOptionalDownloadDialog = false;
let installInProgress = false;
let updateDownloaded = false;
let bootstrapProgressSink: ((percent: number) => void) | null = null;

export function isUpdateInstallInProgress(): boolean {
  return installInProgress || updateDownloaded;
}

function linuxSelfUpdateHint(): string | undefined {
  if (process.platform !== 'linux') return undefined;
  return 'Linux: keep the AppImage in a folder you can write to (for example your Downloads or home directory). Read-only locations prevent automatic updates.';
}

function ensureAutoUpdaterRegistered(): void {
  if (!app.isPackaged || registered) {
    return;
  }
  registered = true;

  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.warn('[updater]', err);
    const msg = String(err?.message ?? err);
    if (process.platform === 'darwin' && /code sign|developer id|signature/i.test(msg)) {
      emitBootstrapState({
        phase: 'manual_required',
        downloadUrl: GITHUB_RELEASES,
        message: 'A newer version is available.',
      });
    }
  });

  autoUpdater.on('download-progress', (p) => {
    bootstrapProgressSink?.(p.percent);
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    const currentMajor = semverMajor(app.getVersion()) ?? 0;
    const newMajor = semverMajor(info.version) ?? 0;
    const isMajorBump = newMajor > currentMajor;

    if (isMajorBump) {
      installInProgress = true;
      emitBootstrapState({
        phase: 'install_pending',
        message: 'Installing update…',
        appVersion: app.getVersion(),
      });
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return;
    }

    if (!postLaunchOptionalUpdatesEnabled || suppressOptionalDownloadDialog) {
      return;
    }
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: `A new version has been downloaded.`,
        detail: 'Restart now to apply the update, or choose Later to install when you quit the app.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          installInProgress = true;
          setImmediate(() => autoUpdater.quitAndInstall());
        }
      });
  });
}

export type PackagedStartupOutcome = 'launch_main' | 'quit_for_install' | 'quit_manual';

/**
 * Packaged startup: server major gate + GitHub auto-update (mandatory or optional).
 * Main window must already be open; states are emitted to the renderer loading screen.
 */
export async function runPackagedStartupFlow(): Promise<PackagedStartupOutcome> {
  ensureAutoUpdaterRegistered();

  emitBootstrapState({
    phase: 'checking_server',
    message: 'Connecting to backend…',
    appVersion: app.getVersion(),
  });

  const gate = await getBackendVersionGate();

  if (!gate.mandatoryMismatch) {
    postLaunchOptionalUpdatesEnabled = true;
    autoUpdater.autoDownload = true;

    emitBootstrapState({
      phase: 'checking_updates',
      message: 'Checking for updates…',
      appVersion: app.getVersion(),
    });

    try {
      const check = await autoUpdater.checkForUpdates();
      const candidate = check?.updateInfo?.version;
      const current = app.getVersion();
      if (candidate && compareSemver(candidate, current) > 0 && isMacUnsigned()) {
        emitBootstrapState({
          phase: 'manual_required',
          downloadUrl: GITHUB_RELEASES,
          message: 'A newer version is available.',
          serverVersion: candidate,
        });
        return 'launch_main';
      }
    } catch (err: unknown) {
      console.warn('[updater] checkForUpdates failed:', err);
    }

    emitBootstrapState({ phase: 'ready', appVersion: app.getVersion() });
    return 'launch_main';
  }

  const hint = linuxSelfUpdateHint();
  const targetMajor = gate.backendMajor;

  emitBootstrapState({
    phase: 'checking_updates',
    message: `Looking for a compatible update for server v${gate.serverVersion ?? 'unknown'}…`,
    serverVersion: gate.serverVersion ?? undefined,
    appVersion: app.getVersion(),
  });

  let check;
  try {
    check = await autoUpdater.checkForUpdates();
  } catch (e) {
    console.warn('[updater] checkForUpdates failed (mandatory path):', e);
    emitBootstrapState({
      phase: 'mandatory_failed',
      message: 'Could not reach the update server. Check your network, or install the latest release manually.',
      downloadUrl: GITHUB_RELEASES,
    });
    return 'quit_manual';
  }

  const info = check?.updateInfo;
  const current = app.getVersion();
  const candidate = info?.version;

  const satisfiesMandatory =
    targetMajor != null &&
    candidate != null &&
    compareSemver(candidate, current) > 0 &&
    semverMajor(candidate) === targetMajor;

  if (!satisfiesMandatory) {
    emitBootstrapState({
      phase: 'mandatory_failed',
      message: `No compatible automatic update was found for server major ${targetMajor}. Install the matching release from GitHub.`,
      downloadUrl: GITHUB_RELEASES,
    });
    return 'quit_manual';
  }

  if (isMacUnsigned()) {
    emitBootstrapState({
      phase: 'manual_required',
      downloadUrl: GITHUB_RELEASES,
      message: 'A newer version is available.',
      serverVersion: candidate,
    });
    return 'quit_manual';
  }

  emitBootstrapState({
    phase: 'downloading',
    message: `Downloading v${candidate}…`,
    progress: 0,
    appVersion: app.getVersion(),
  });

  bootstrapProgressSink = (percent) => {
    emitBootstrapState({
      phase: 'downloading',
      message: `Downloading v${candidate}…`,
      progress: Math.round(percent),
      appVersion: app.getVersion(),
    });
  };

  suppressOptionalDownloadDialog = true;
  try {
    await autoUpdater.downloadUpdate();
  } catch (e) {
    console.warn('[updater] downloadUpdate failed:', e);
    suppressOptionalDownloadDialog = false;
    bootstrapProgressSink = null;
    emitBootstrapState({
      phase: 'mandatory_failed',
      message: hint
        ? `Download failed. ${hint}`
        : 'Download failed. Try again from a stable connection, or install manually from GitHub.',
      downloadUrl: GITHUB_RELEASES,
    });
    return 'quit_manual';
  } finally {
    suppressOptionalDownloadDialog = false;
    bootstrapProgressSink = null;
  }

  emitBootstrapState({
    phase: 'install_pending',
    message: 'Installing update…',
    progress: 100,
    appVersion: app.getVersion(),
  });

  installInProgress = true;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return 'quit_for_install';
}

export type UpdaterCheckResult = {
  status: 'up_to_date' | 'update_available' | 'manual_required' | 'error';
  version?: string;
  downloadUrl?: string;
  error?: string;
};

export async function manualUpdaterCheck(): Promise<UpdaterCheckResult> {
  if (!app.isPackaged) {
    return { status: 'up_to_date', version: app.getVersion() };
  }

  ensureAutoUpdaterRegistered();

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo) {
      return { status: 'up_to_date', version: app.getVersion() };
    }
    const candidate = result.updateInfo.version;
    if (compareSemver(candidate, app.getVersion()) <= 0) {
      return { status: 'up_to_date', version: app.getVersion() };
    }
    if (isMacUnsigned()) {
      return {
        status: 'manual_required',
        version: candidate,
        downloadUrl: GITHUB_RELEASES,
      };
    }
    return { status: 'update_available', version: candidate };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.platform === 'darwin' && /code sign|developer id|signature/i.test(msg)) {
      return {
        status: 'manual_required',
        downloadUrl: GITHUB_RELEASES,
        error: msg,
      };
    }
    return { status: 'error', error: msg };
  }
}
