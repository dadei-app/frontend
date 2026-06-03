import { app, dialog } from 'electron';
import axios from 'axios';
import { autoUpdater } from 'electron-updater';
import type { UpdaterSplashPayload } from './updater-splash-types';
import { sendUpdaterSplashState } from './updater-window';

const ROOT_TIMEOUT_MS = 10_000;

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
let splashProgressSink: ((percent: number) => void) | null = null;

export function isUpdateInstallInProgress(): boolean {
  return installInProgress || updateDownloaded;
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
  });

  autoUpdater.on('download-progress', (p) => {
    splashProgressSink?.(p.percent);
  });

  autoUpdater.on('update-downloaded', () => {
    updateDownloaded = true;
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

function linuxSelfUpdateHint(): string | undefined {
  if (process.platform !== 'linux') return undefined;
  return 'Linux: keep the AppImage in a folder you can write to (for example your Downloads or home directory). Read-only locations prevent automatic updates.';
}

function pushSplash(payload: UpdaterSplashPayload): void {
  sendUpdaterSplashState(payload);
}

export type PackagedStartupOutcome = 'launch_main' | 'quit_for_install' | 'quit_manual';

/**
 * Packaged startup: server major gate + GitHub auto-update (mandatory or optional).
 * Splash must already be visible; this function never opens the main window.
 */
export async function runPackagedStartupFlow(): Promise<PackagedStartupOutcome> {
  ensureAutoUpdaterRegistered();

  pushSplash({
    title: 'dadei — Updater',
    message: 'Checking server and updates…',
    progress: null,
  });

  const gate = await getBackendVersionGate();

  if (!gate.mandatoryMismatch) {
    postLaunchOptionalUpdatesEnabled = true;
    autoUpdater.autoDownload = true;
    pushSplash({
      message: 'Starting…',
      progress: null,
    });
    void autoUpdater.checkForUpdates().catch((err: unknown) => {
      console.warn('[updater] checkForUpdates failed:', err);
    });
    return 'launch_main';
  }

  const hint = linuxSelfUpdateHint();
  const targetMajor = gate.backendMajor;

  pushSplash({
    title: 'Update required',
    message: `This app (v${app.getVersion()}) cannot run against the server (${gate.serverVersion ?? 'unknown'}). Looking for a compatible update…`,
    progress: null,
    hint,
  });

  let check;
  try {
    check = await autoUpdater.checkForUpdates();
  } catch (e) {
    console.warn('[updater] checkForUpdates failed (mandatory path):', e);
    pushSplash({
      title: 'Update required',
      message: 'Could not reach the update server. Check your network, or install the latest release manually.',
      progress: null,
      showActions: true,
      primaryLabel: 'Open releases',
      hint,
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
    pushSplash({
      title: 'Update required',
      message: `No compatible automatic update was found for server major ${targetMajor}. Install the matching release from GitHub.`,
      progress: null,
      showActions: true,
      primaryLabel: 'Open releases',
      hint,
    });
    return 'quit_manual';
  }

  pushSplash({
    title: 'Update required',
    message: `Downloading v${candidate}…`,
    progress: 0,
    hint,
  });

  splashProgressSink = (percent) => {
    pushSplash({
      title: 'Update required',
      message: `Downloading v${candidate}…`,
      progress: percent,
      hint,
    });
  };

  suppressOptionalDownloadDialog = true;
  try {
    await autoUpdater.downloadUpdate();
  } catch (e) {
    console.warn('[updater] downloadUpdate failed:', e);
    suppressOptionalDownloadDialog = false;
    splashProgressSink = null;
    pushSplash({
      title: 'Update required',
      message: 'Download failed. Try again from a stable connection, or install manually from GitHub.',
      progress: null,
      showActions: true,
      primaryLabel: 'Open releases',
      hint,
    });
    return 'quit_manual';
  } finally {
    suppressOptionalDownloadDialog = false;
    splashProgressSink = null;
  }

  pushSplash({
    title: 'Update required',
    message: 'Installing update…',
    progress: 100,
    hint,
  });

  installInProgress = true;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return 'quit_for_install';
}

const GITHUB_RELEASES = 'https://github.com/dadei-app/frontend/releases';

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
    if (process.platform === 'darwin' && !process.env.MAC_SIGNED) {
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
