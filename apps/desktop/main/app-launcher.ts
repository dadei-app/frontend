import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

async function runCommand(command: string, args: string[] = [], env?: NodeJS.ProcessEnv): Promise<boolean> {
  try {
    await execFileAsync(command, args, { windowsHide: true, env: { ...process.env, ...env } });
    return true;
  } catch (error) {
    console.warn('[app-launcher] command failed', command, args, error);
    return false;
  }
}

const WINDOWS_OPEN_APP_PS = `
$ErrorActionPreference = 'Stop'
$query = [string]$env:DADEI_APP_QUERY
if ([string]::IsNullOrWhiteSpace($query)) { exit 1 }
$q = $query.Trim()
$pattern = "*$q*"

function Launch-AppId([string]$appId) {
  if ([string]::IsNullOrWhiteSpace($appId)) { return $false }
  Start-Process -FilePath 'explorer.exe' -ArgumentList "shell:AppsFolder\\$appId" | Out-Null
  return $true
}

$startApps = @(Get-StartApps | Where-Object { $_.Name -like $pattern })
if ($startApps.Count -ge 1) {
  $exact = @($startApps | Where-Object { $_.Name -ieq $q })
  $pick = if ($exact.Count -ge 1) { $exact[0] } else { $startApps[0] }
  if (Launch-AppId $pick.AppID) { exit 0 }
}

$roots = @(
  [Environment]::GetFolderPath('CommonPrograms'),
  [Environment]::GetFolderPath('Programs')
)
$shell = New-Object -ComObject WScript.Shell
foreach ($root in $roots) {
  if (-not (Test-Path $root)) { continue }
  $links = Get-ChildItem -Path $root -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue
  foreach ($lnk in $links) {
    if ($lnk.BaseName -notlike $pattern) { continue }
    $shortcut = $shell.CreateShortcut($lnk.FullName)
    $target = [string]$shortcut.TargetPath
    $args = [string]$shortcut.Arguments
    if ($target) {
      if ($args) { Start-Process -FilePath $target -ArgumentList $args | Out-Null }
      else { Start-Process -FilePath $target | Out-Null }
      exit 0
    }
  }
}

$steamExe = Join-Path \${env:ProgramFiles(x86)} 'Steam\\steam.exe'
if (-not (Test-Path $steamExe)) {
  $steamExe = Join-Path $env:ProgramFiles 'Steam\\steam.exe'
}
if (Test-Path $steamExe) {
  $libraryRoots = @()
  $vdf = Join-Path (Split-Path $steamExe -Parent) 'config\\libraryfolders.vdf'
  if (Test-Path $vdf) {
    $raw = Get-Content $vdf -Raw
    $matches = [regex]::Matches($raw, '"path"\\s+"([^"]+)"')
    foreach ($m in $matches) { $libraryRoots += $m.Groups[1].Value.Replace('\\\\', '\\') }
  }
  if ($libraryRoots.Count -eq 0) {
    $libraryRoots += Split-Path $steamExe -Parent
  }
  foreach ($lib in $libraryRoots) {
    $manifestRoot = Join-Path $lib 'steamapps'
    $manifests = Get-ChildItem -Path $manifestRoot -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue
    foreach ($manifest in $manifests) {
      $content = Get-Content $manifest.FullName -Raw
      $nameMatch = [regex]::Match($content, '"name"\\s+"([^"]+)"')
      if (-not $nameMatch.Success) { continue }
      $gameName = $nameMatch.Groups[1].Value
      if ($gameName -notlike $pattern) { continue }
      $appMatch = [regex]::Match($content, '"appid"\\s+"(\\d+)"')
      if ($appMatch.Success) {
        $appId = $appMatch.Groups[1].Value
        Start-Process -FilePath $steamExe -ArgumentList "steam://rungameid/$appId" | Out-Null
        exit 0
      }
    }
  }
}

if (Test-Path $q) {
  Start-Process -FilePath $q | Out-Null
  exit 0
}

try {
  Start-Process -FilePath $q | Out-Null
  exit 0
} catch {
  exit 1
}
`;

async function openAppWindows(name: string): Promise<boolean> {
  return runCommand(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', WINDOWS_OPEN_APP_PS],
    { DADEI_APP_QUERY: name },
  );
}

async function openAppMac(name: string): Promise<boolean> {
  if (await runCommand('open', ['-a', name])) return true;
  try {
    const safeName = name.replace(/'/g, '');
    const { stdout } = await execFileAsync(
      'mdfind',
      ['-name', `${safeName}.app`],
      { windowsHide: true },
    );
    const appPath = String(stdout)
      .trim()
      .split('\n')
      .find((line) => line.trim().endsWith('.app'));
    if (appPath) return runCommand('open', [appPath.trim()]);
  } catch (error) {
    console.warn('[app-launcher] mac mdfind failed', error);
  }
  return false;
}

async function openAppLinux(name: string): Promise<boolean> {
  const query = name.toLowerCase();
  const desktopDirs = [
    '/usr/share/applications',
    `${process.env.HOME || ''}/.local/share/applications`,
  ].filter(Boolean);

  for (const dir of desktopDirs) {
    let entries: string[] = [];
    try {
      entries = await fs.promises.readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.desktop')) continue;
      const fullPath = path.join(dir, entry);
      try {
        const content = await fs.promises.readFile(fullPath, 'utf8');
        const nameMatch = content.match(/^Name=(.+)$/im);
        const execMatch = content.match(/^Exec=(.+)$/im);
        if (!nameMatch || !execMatch) continue;
        const displayName = nameMatch[1].trim().toLowerCase();
        if (!displayName.includes(query)) continue;
        const execLine = execMatch[1].trim().replace(/%./, '').trim();
        const desktopId = entry.replace(/\.desktop$/, '');
        if (await runCommand('gtk-launch', [desktopId])) return true;
        if (await runCommand('sh', ['-lc', execLine])) return true;
      } catch {
        continue;
      }
    }
  }
  return runCommand('xdg-open', [name]);
}

export async function openApp(name: string): Promise<boolean> {
  const target = name.trim();
  if (!target) return false;
  if (process.platform === 'win32') return openAppWindows(target);
  if (process.platform === 'darwin') return openAppMac(target);
  return openAppLinux(target);
}
