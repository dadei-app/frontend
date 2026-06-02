import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(desktopRoot, '..', '..');

function loadEnvFile(filePath, { override } = { override: false }) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(frontendRoot, '.env'), { override: false });
loadEnvFile(path.join(frontendRoot, '.env.local'), { override: true });

const port = process.env.RENDERER_DEV_PORT || '59247';

function listeningPidsOnPort(targetPort) {
  if (process.platform === 'win32') {
    const out = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const local = parts[1];
      const pid = parts[parts.length - 1];
      if (!local || !pid || !/^\d+$/.test(pid)) continue;
      if (local.endsWith(`:${targetPort}`)) pids.add(pid);
    }
    return [...pids];
  }

  try {
    const out = execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, {
      encoding: 'utf8',
    });
    return out
      .trim()
      .split('\n')
      .filter((pid) => /^\d+$/.test(pid));
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', windowsHide: true });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

const pids = listeningPidsOnPort(port);
if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  if (killPid(pid)) {
    console.log(`[free-renderer-port] Stopped process ${pid} on port ${port}`);
  }
}
