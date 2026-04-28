// 13.1 — Build the SPA in networked mode.
//
// We don't depend on `cross-env` or any other shell helper because cross-platform
// env handling is exactly what a tiny Node wrapper does well: set the env vars
// in-process, then spawn `vite build` with stdio inherited.
//
// VITE_CLIENT_MODE flips the client transport (see src/clientMode.ts) to
// SocketIO at the bgio server address. VITE_SERVER_URL defaults to localhost
// for ad-hoc local builds; CI / Render set it to the real server URL.
//
// Why not put this logic in `package.json` directly?
// - `VAR=value cmd` doesn't work on Windows cmd.exe.
// - Adding `cross-env` adds a devDep we don't otherwise need.
// - This script is small and stays portable.
//
// We resolve the `vite` binary via Node's createRequire so we don't depend on
// `npx` / `.cmd` shims that Node's `spawnSync` mishandles on Windows
// (spawnSync errors out with EINVAL for `.cmd` files unless `shell: true`,
// and `shell: true` opens its own quoting can of worms). Going through the
// resolved JS entry sidesteps both issues.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

process.env.VITE_CLIENT_MODE = 'networked';
process.env.VITE_SERVER_URL =
  process.env.VITE_SERVER_URL ?? 'http://localhost:8000';

const here = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);

// vite ships its CLI as `vite/bin/vite.js`. Its package.json declares the
// `vite` entry as the API; we want the CLI script. We resolve via the
// package.json path to keep this version-agnostic.
const vitePkgPath = require_.resolve('vite/package.json');
const viteCliPath = resolve(dirname(vitePkgPath), 'bin/vite.js');

if (!existsSync(viteCliPath)) {
  console.error(
    `[build-networked] could not locate vite CLI at ${viteCliPath}. ` +
      `Run \`npm install\` to install dependencies.`,
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [viteCliPath, 'build'], {
  stdio: 'inherit',
  cwd: resolve(here, '..'),
  env: process.env,
});

if (result.error) {
  console.error('[build-networked] spawn error:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
