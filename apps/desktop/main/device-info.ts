import { app, desktopCapturer, powerMonitor, screen } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type NowPlayingInfo = {
  playing: boolean;
  title?: string;
  artist?: string;
  album?: string;
  app?: string;
};

export type BatteryInfo = {
  available: boolean;
  percent: number | null;
  charging: boolean | null;
  on_battery: boolean;
};

export type ScreenshotInfo = {
  ok: boolean;
  path?: string;
  error?: string;
};

export type DeviceInfoKey = 'now_playing' | 'battery' | 'screenshot';

async function runPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
  );
  return String(stdout).trim();
}

async function getNowPlayingWindows(): Promise<NowPlayingInfo> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]
function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media,ContentType=WindowsRuntime] | Out-Null
$manager = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::GetForCurrentUser()
$sessions = $manager.GetSessions()
foreach ($s in $sessions) {
  try {
    $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.MediaProperties.MusicDisplayProperties])
    $title = [string]$props.Title
    $artist = [string]$props.Artist
    $album = [string]$props.AlbumTitle
    $app = [string]$s.SourceAppUserModelId
    if ($title -or $artist) {
      $payload = [ordered]@{
        playing = $true
        title = $title
        artist = $artist
        album = $album
        app = $app
      }
      $payload | ConvertTo-Json -Compress
      exit 0
    }
  } catch {}
}
@{ playing = $false } | ConvertTo-Json -Compress
`;
  try {
    const raw = await runPowerShell(script);
    if (!raw) return { playing: false };
    const parsed = JSON.parse(raw) as NowPlayingInfo;
    return { playing: Boolean(parsed.playing), title: parsed.title, artist: parsed.artist, album: parsed.album, app: parsed.app };
  } catch (error) {
    console.warn('[device-info] now playing (windows) failed', error);
    return { playing: false };
  }
}

async function readMacPlayer(app: 'Spotify' | 'Music'): Promise<NowPlayingInfo | null> {
  const script = `
tell application "${app}"
  if it is running then
    set trackName to name of current track
    set trackArtist to artist of current track
    set trackAlbum to album of current track
    return trackName & "||" & trackArtist & "||" & trackAlbum
  end if
end tell
`;
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { windowsHide: true });
    const raw = String(stdout).trim();
    if (!raw) return null;
    const [title, artist, album] = raw.split('||');
    if (!title) return null;
    return {
      playing: true,
      title: title.trim() || undefined,
      artist: artist?.trim() || undefined,
      album: album?.trim() || undefined,
      app,
    };
  } catch {
    return null;
  }
}

async function getNowPlayingMac(): Promise<NowPlayingInfo> {
  const spotify = await readMacPlayer('Spotify');
  if (spotify) return spotify;
  const music = await readMacPlayer('Music');
  if (music) return music;
  return { playing: false };
}

async function getNowPlayingLinux(): Promise<NowPlayingInfo> {
  try {
    const { stdout: status } = await execFileAsync('playerctl', ['-s', 'status'], { windowsHide: true });
    const state = String(status).trim().toLowerCase();
    if (state !== 'playing') return { playing: false };
    const { stdout: title } = await execFileAsync('playerctl', ['metadata', 'title'], { windowsHide: true });
    const { stdout: artist } = await execFileAsync('playerctl', ['metadata', 'artist'], { windowsHide: true });
    const { stdout: album } = await execFileAsync('playerctl', ['metadata', 'album'], { windowsHide: true });
    return {
      playing: true,
      title: String(title).trim() || undefined,
      artist: String(artist).trim() || undefined,
      album: String(album).trim() || undefined,
      app: 'playerctl',
    };
  } catch (error) {
    console.warn('[device-info] now playing (linux) failed', error);
    return { playing: false };
  }
}

export async function getNowPlaying(): Promise<NowPlayingInfo> {
  if (process.platform === 'win32') return getNowPlayingWindows();
  if (process.platform === 'darwin') return getNowPlayingMac();
  return getNowPlayingLinux();
}

async function getBatteryWindows(): Promise<BatteryInfo> {
  const script = `
$bat = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $bat) {
  @{ available = $false; percent = $null; charging = $null; on_battery = $false } | ConvertTo-Json -Compress
  exit 0
}
$percent = [int]$bat.EstimatedChargeRemaining
$charging = $bat.BatteryStatus -in 2,6,7,8,9
@{ available = $true; percent = $percent; charging = $charging; on_battery = -not $charging } | ConvertTo-Json -Compress
`;
  try {
    const raw = await runPowerShell(script);
    const parsed = JSON.parse(raw) as BatteryInfo;
    return {
      available: Boolean(parsed.available),
      percent: typeof parsed.percent === 'number' ? parsed.percent : null,
      charging: typeof parsed.charging === 'boolean' ? parsed.charging : null,
      on_battery: Boolean(parsed.on_battery),
    };
  } catch (error) {
    console.warn('[device-info] battery (windows) failed', error);
    return { available: false, percent: null, charging: null, on_battery: false };
  }
}

async function getBatteryMac(): Promise<BatteryInfo> {
  try {
    const { stdout } = await execFileAsync('pmset', ['-g', 'batt'], { windowsHide: true });
    const text = String(stdout);
    const percentMatch = text.match(/(\d+)%/);
    const onBattery = /\bdischarging\b/i.test(text) || (text.includes("'battery") && !/charged|finishing charge/i.test(text));
    const charging = /\bcharging\b/i.test(text) || /finishing charge/i.test(text);
    const percent = percentMatch ? Number(percentMatch[1]) : null;
    const hasBattery = percent != null || /battery/i.test(text);
    return {
      available: hasBattery,
      percent,
      charging: hasBattery ? charging : null,
      on_battery: hasBattery ? onBattery && !charging : false,
    };
  } catch (error) {
    console.warn('[device-info] battery (mac) failed', error);
    return { available: false, percent: null, charging: null, on_battery: false };
  }
}

async function getBatteryLinux(): Promise<BatteryInfo> {
  const base = '/sys/class/power_supply';
  try {
    const entries = await fs.promises.readdir(base);
    const batteryName = entries.find((e) => e.toLowerCase().includes('bat'));
    if (!batteryName) {
      return { available: false, percent: null, charging: null, on_battery: false };
    }
    const root = path.join(base, batteryName);
    const [capRaw, statusRaw] = await Promise.all([
      fs.promises.readFile(path.join(root, 'capacity'), 'utf8').catch(() => ''),
      fs.promises.readFile(path.join(root, 'status'), 'utf8').catch(() => ''),
    ]);
    const percent = Number(String(capRaw).trim());
    const status = String(statusRaw).trim().toLowerCase();
    const charging = status === 'charging' || status === 'full';
    return {
      available: Number.isFinite(percent),
      percent: Number.isFinite(percent) ? percent : null,
      charging,
      on_battery: !charging,
    };
  } catch (error) {
    console.warn('[device-info] battery (linux) failed', error);
    return { available: false, percent: null, charging: null, on_battery: false };
  }
}

export async function getBattery(): Promise<BatteryInfo> {
  if (process.platform === 'win32') return getBatteryWindows();
  if (process.platform === 'darwin') return getBatteryMac();
  return getBatteryLinux();
}

export async function captureScreenshot(): Promise<ScreenshotInfo> {
  try {
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.size;
    const scale = display.scaleFactor || 1;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      },
    });
    const primary =
      sources.find((s) => String(s.display_id) === String(display.id)) ?? sources[0];
    if (!primary) return { ok: false, error: 'No screen source available' };
    const dir = path.join(app.getPath('pictures'), 'Dadei');
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `screenshot-${Date.now()}.png`);
    const png = primary.thumbnail.toPNG();
    if (!png?.length) return { ok: false, error: 'Empty screenshot buffer' };
    await writeFile(filePath, png);
    return { ok: true, path: filePath };
  } catch (error) {
    console.warn('[device-info] screenshot failed', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Screenshot failed' };
  }
}

async function runCommand(command: string, args: string[] = []): Promise<boolean> {
  try {
    await execFileAsync(command, args, { windowsHide: true });
    return true;
  } catch (error) {
    console.warn('[device-info] command failed', command, args, error);
    return false;
  }
}

async function toggleDndWindows(): Promise<boolean> {
  const script = `
$path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings'
if (-not (Test-Path $path)) { exit 1 }
$name = 'NOC_GLOBAL_SETTING_TOASTS_ENABLED'
$current = (Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue).$name
if ($null -eq $current) { $current = 1 }
$next = if ([int]$current -eq 1) { 0 } else { 1 }
Set-ItemProperty -Path $path -Name $name -Value $next -Type DWord -Force
exit 0
`;
  return runCommand('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
}

async function toggleDndMac(): Promise<boolean> {
  const script = `
try
  do shell script "shortcuts run Focus" without altering line endings
  return "ok"
on error
  try
    tell application "System Events"
      key code 96 using {control down, option down}
    end tell
    return "ok"
  on error
    return "fail"
  end try
end try
`;
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { windowsHide: true });
    return String(stdout).trim() === 'ok';
  } catch {
    return false;
  }
}

async function toggleDndLinux(): Promise<boolean> {
  if (await runCommand('gsettings', ['get', 'org.gnome.desktop.notifications', 'show-banners'])) {
    try {
      const { stdout } = await execFileAsync(
        'gsettings',
        ['get', 'org.gnome.desktop.notifications', 'show-banners'],
        { windowsHide: true },
      );
      const enabled = String(stdout).trim() === 'true';
      return runCommand('gsettings', [
        'set',
        'org.gnome.desktop.notifications',
        'show-banners',
        enabled ? 'false' : 'true',
      ]);
    } catch {
      return false;
    }
  }
  return false;
}

export async function toggleDoNotDisturb(): Promise<boolean> {
  if (process.platform === 'win32') return toggleDndWindows();
  if (process.platform === 'darwin') return toggleDndMac();
  return toggleDndLinux();
}

export async function collectDeviceInfo(
  keys: DeviceInfoKey[],
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  const tasks = keys.map(async (key) => {
    if (key === 'now_playing') data.now_playing = await getNowPlaying();
    if (key === 'battery') {
      const battery = await getBattery();
      data.battery = battery;
      data.on_battery_power = powerMonitor.isOnBatteryPower();
    }
    if (key === 'screenshot') data.screenshot = await captureScreenshot();
  });
  await Promise.all(tasks);
  return data;
}
