// 14.14 — explicit boot entry point.
//
// `server/index.ts` exports `createServer` and ALSO bootstraps when
// invoked directly via tsx (it compares `import.meta.url` against
// `process.argv[1]`). That detection is brittle under runners that
// set `argv[1]` to their own CLI script — including vite-node, which
// 14.14 adopted as the canonical dev runner because tsx 4.x mis-
// resolves bgio subpath imports (see plans/14.11-...-findings.md F1).
//
// This file always boots the server — no ambient detection. The npm
// scripts in package.json point here for `server:dev` / `dev:server`
// / `server:start` so the runner choice no longer matters.
//
// Why we don't just remove `index.ts`'s direct-invocation block: the
// existing tests + Render Dockerfile both rely on it, and a separate
// boot file is a less invasive seam than gutting the existing one.

import { createServer } from './index.ts';
import type { StorageKind } from './storage/index.ts';

const port = Number(process.env.PORT ?? '8000');

const envKind = process.env.STORAGE_KIND;
const storageKind: StorageKind | undefined =
  envKind === 'memory' || envKind === 'flatfile' || envKind === 'sqlite'
    ? envKind
    : undefined;

void createServer({ port, storage: storageKind ?? 'memory' }).start(port);
