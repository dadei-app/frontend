import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { shell } from 'electron';

const execFileAsync = promisify(execFile);

type BrowserLaunch = {
  command: string;
  args: string[];
};

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function spawnDetached(launch: BrowserLaunch): void {
  const child = spawn(launch.command, launch.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function chromiumNewWindowArgs(url: string): string[] {
  return ['--new-window', url];
}

function resolveWindowsLaunch(progId: string, url: string): BrowserLaunch | null {
  const id = progId.toLowerCase();
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';

  if (id.includes('firefox')) {
    const exe = firstExisting([
      path.join(programFiles, 'Mozilla Firefox', 'firefox.exe'),
      path.join(programFilesX86, 'Mozilla Firefox', 'firefox.exe'),
    ]);
    return exe ? { command: exe, args: ['-new-window', url] } : null;
  }

  if (id.includes('edge') || id.includes('msedge')) {
    const exe = firstExisting([
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
    return exe ? { command: exe, args: chromiumNewWindowArgs(url) } : null;
  }

  if (id.includes('brave')) {
    const exe = firstExisting([
      path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ]);
    return exe ? { command: exe, args: chromiumNewWindowArgs(url) } : null;
  }

  if (id.includes('chrome')) {
    const exe = firstExisting([
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]);
    return exe ? { command: exe, args: chromiumNewWindowArgs(url) } : null;
  }

  return null;
}

async function windowsDefaultBrowserProgId(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      "(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice' -ErrorAction SilentlyContinue).ProgId",
    ]);
    const progId = stdout.trim();
    return progId || null;
  } catch {
    return null;
  }
}

async function openWindowsBrowserWindow(url: string): Promise<boolean> {
  const progId = await windowsDefaultBrowserProgId();
  if (!progId) {
    return false;
  }

  const launch = resolveWindowsLaunch(progId, url);
  if (!launch) {
    return false;
  }

  spawnDetached(launch);
  return true;
}

const MAC_BROWSERS: Array<{ bundleId: string; appName: string }> = [
  { bundleId: 'com.google.Chrome', appName: 'Google Chrome' },
  { bundleId: 'com.microsoft.edgemac', appName: 'Microsoft Edge' },
  { bundleId: 'com.brave.Browser', appName: 'Brave Browser' },
  { bundleId: 'org.mozilla.firefox', appName: 'Firefox' },
];

async function macDefaultBrowserBundleId(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c',
      'import sys\n' +
        'try:\n' +
        '    import LaunchServices\n' +
        'except ImportError:\n' +
        '    sys.exit(1)\n' +
        'bundle = LaunchServices.LSCopyDefaultHandlerForURLScheme("https")\n' +
        'print(bundle or "")',
    ]);
    const bundleId = stdout.trim();
    return bundleId || null;
  } catch {
    return null;
  }
}

async function openMacBrowserWindow(url: string): Promise<boolean> {
  const bundleId = await macDefaultBrowserBundleId();
  const browser = MAC_BROWSERS.find((entry) => entry.bundleId === bundleId);

  try {
    if (browser?.appName === 'Firefox') {
      await execFileAsync('open', ['-na', browser.appName, '--args', '-new-window', url]);
      return true;
    }
    if (browser) {
      await execFileAsync('open', ['-na', browser.appName, '--args', '--new-window', url]);
      return true;
    }
    await execFileAsync('open', ['-n', url]);
    return true;
  } catch {
    return false;
  }
}

async function openLinuxBrowserWindow(url: string): Promise<boolean> {
  const candidates: BrowserLaunch[] = [
    { command: 'google-chrome', args: chromiumNewWindowArgs(url) },
    { command: 'google-chrome-stable', args: chromiumNewWindowArgs(url) },
    { command: 'chromium', args: chromiumNewWindowArgs(url) },
    { command: 'chromium-browser', args: chromiumNewWindowArgs(url) },
    { command: 'microsoft-edge', args: chromiumNewWindowArgs(url) },
    { command: 'brave-browser', args: chromiumNewWindowArgs(url) },
    { command: 'firefox', args: ['-new-window', url] },
  ];

  for (const launch of candidates) {
    try {
      await execFileAsync('which', [launch.command]);
      spawnDetached(launch);
      return true;
    } catch {
      /* try next browser */
    }
  }

  return false;
}

/** Open OAuth in a new window of the system default browser (keeps cookies/profile). */
export async function openDefaultBrowserOAuthWindow(url: string): Promise<void> {
  let opened = false;

  if (process.platform === 'win32') {
    opened = await openWindowsBrowserWindow(url);
  } else if (process.platform === 'darwin') {
    opened = await openMacBrowserWindow(url);
  } else if (process.platform === 'linux') {
    opened = await openLinuxBrowserWindow(url);
  }

  if (!opened) {
    await shell.openExternal(url);
  }
}
