// Free the ports `dev:full` needs (5179 client, 8000 server) before
// concurrently spawns its children. Without this, a stale long-running
// `vite dev` from a previous session pins :5179 in `LISTENING` state
// and the new client crash-exits ("Port 5179 is already in use") —
// `vite.config.ts` sets `strictPort: true` because Playwright depends
// on the port being deterministic.
//
// Cross-platform via `os.platform()`; uses only Node built-ins (no
// extra deps). Best-effort: errors are reported but don't fail the
// hook — the next process will surface a clearer error if a port
// can't be freed.
//
// Usage: `node scripts/free-ports.mjs 5179 8000`. With no args,
// defaults to `[5179, 8000]`.

import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const PORTS = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n));
const ports = PORTS.length > 0 ? PORTS : [5179, 8000];

const killWindows = (port) => {
  // `netstat -ano` lists every connection with its owning PID; we
  // grep for a LISTENING line on the target port and pull col[-1].
  const out = spawnSync('netstat', ['-ano'], { encoding: 'utf-8' });
  if (out.status !== 0) {
    console.error(`[free-ports] netstat failed: ${out.stderr ?? ''}`);
    return;
  }
  const pids = new Set();
  for (const line of (out.stdout ?? '').split(/\r?\n/)) {
    const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
    if (m && Number(m[1]) === port) pids.add(m[2]);
  }
  for (const pid of pids) {
    const k = spawnSync('taskkill', ['/PID', pid, '/F'], { encoding: 'utf-8' });
    if (k.status === 0) {
      console.log(`[free-ports] killed PID ${pid} (port ${port})`);
    } else {
      const err = (k.stderr ?? '').trim();
      console.error(`[free-ports] taskkill ${pid} failed: ${err}`);
      if (/Access is denied/i.test(err)) {
        console.error(
          `[free-ports] Hint: PID ${pid} is owned by another user/elevated session.`,
        );
        console.error(
          `[free-ports] If a previous \`npm run dev:full\` is running in another terminal, stop it (Ctrl+C) and re-run.`,
        );
      }
    }
  }
};

const killUnix = (port) => {
  // `lsof -ti:PORT` prints the PID(s); pipe to kill -9.
  const out = spawnSync('lsof', ['-ti', `:${port}`], { encoding: 'utf-8' });
  // lsof exits 1 when no match; that's the "already free" path.
  if (out.status !== 0) return;
  const pids = (out.stdout ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
  for (const pid of pids) {
    const k = spawnSync('kill', ['-9', pid]);
    if (k.status === 0) {
      console.log(`[free-ports] killed PID ${pid} (port ${port})`);
    } else {
      console.error(`[free-ports] kill ${pid} failed`);
    }
  }
};

const isWindows = platform() === 'win32';
const killer = isWindows ? killWindows : killUnix;

for (const port of ports) killer(port);
