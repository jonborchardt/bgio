# 02 — Pages publishes the networked client (with `#hotseat` runtime escape) pointed at Render

**Severity**: high (without this, "users hit my client via GitHub"
still gets the hot-seat build with no server)
**Area**: client / build / CI
**Effort**: small
**Status**: not started
**Depends on**: plan 03 in the same PR (CORS env). Don't merge this
ahead of plan 03 or the live Pages site will load but every
auth/lobby request will fail CORS.

## Files

New:
- (new) `deploy.config.json` at the repo root — the single source
  of truth for the Render service URL and canonical Pages URL.

Edited:
- [scripts/build-networked.mjs](../../scripts/build-networked.mjs)
  — read `renderServerUrl` from the config; pass through any
  explicit `VITE_SERVER_URL` env override (used for local builds
  against a non-prod server).
- [src/clientMode.ts](../../src/clientMode.ts) —
  `detectMode()` honours `window.location.hash === '#hotseat'`
  before falling back to the build-time `VITE_CLIENT_MODE`.
- [src/App.tsx](../../src/App.tsx) — verify both shells
  (`<NetworkedShell>` + `<HotSeatShell>`) are statically imported
  so the bundle ships both transports. If a conditional dynamic
  import was tree-shaking one out, lift it to a static import.
- [.github/workflows/deploy-pages.yml:34-39](../../.github/workflows/deploy-pages.yml)
  — flip `npm run build:hotseat` → `npm run build:networked`.
  No env var to inject; the script reads the config.

Unchanged (load-bearing context):
- [src/clientMode.ts:50-52](../../src/clientMode.ts) — the
  `getServerURL()` reader of `import.meta.env.VITE_SERVER_URL`
  stays as-is. The build script keeps writing that env at build
  time; the change is *where the build script gets the value
  from*.
- [.env.example](../../.env.example) — `VITE_SERVER_URL` stays
  documented as the local-dev override.

## Problem

Three things are wrong today, all small:

1. **The Pages workflow builds the wrong thing.** `build:hotseat`
   ships the demo / fallback path. The user's question is "anyone
   hitting Pages can matchmake on Render" — that requires
   `build:networked` with the Render URL baked in.
2. **The Render URL has no canonical home.** Today,
   `build-networked.mjs` reads `VITE_SERVER_URL` from
   `process.env`. There is no checked-in default; the deployed
   bundle's URL would have to come from a GitHub Actions repo
   variable or be hardcoded into the workflow. The user wants the
   value in a checked-in config file instead.
3. **The bundle is single-mode at build time.** The user wants
   prod to support both modes — default networked, with
   `/#hotseat` mounting the hot-seat shell as an escape hatch
   (works at the same Pages URL, no separate branch / build).

## Fix sketch

### 1. Add `deploy.config.json`

```json
{
  "renderServerUrl": "https://settlement-server.onrender.com",
  "pagesUrl": "https://jonborchardt.github.io/bgio/"
}
```

- `renderServerUrl` is consumed by `build-networked.mjs` (set as
  `VITE_SERVER_URL` for the Vite build).
- `pagesUrl` is documentation + a cross-reference for plan 03's
  `ALLOWED_ORIGINS` value (the *origin* of `pagesUrl` —
  `https://jonborchardt.github.io` — is what goes in
  `render.yaml`).

**Render service URL caveat.** `render.yaml` names the service
`settlement-server`, so the URL is most likely
`https://settlement-server.onrender.com`. Render sometimes appends
a hash (e.g. `https://settlement-server-abc123.onrender.com`).
Confirm from the Render dashboard before merging and put the real
value in the config.

### 2. `scripts/build-networked.mjs`

Today the script reads `process.env.VITE_SERVER_URL` and falls
back to nothing (Vite build runs with localhost-default if the env
isn't set, which is wrong for the prod bundle). Change to:

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, '..', 'deploy.config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const serverUrl = process.env.VITE_SERVER_URL || config.renderServerUrl;
// ...spawn vite with VITE_CLIENT_MODE=networked + VITE_SERVER_URL=$serverUrl
```

The env var stays the override path so a developer can do
`VITE_SERVER_URL=http://localhost:8000 npm run build:networked` to
test against a local server without editing the config.

### 3. Runtime mode toggle in `src/clientMode.ts`

Existing `detectMode()` returns the build-time mode. Extend it to
honour a URL-fragment override:

```ts
export function detectMode(): 'hotseat' | 'networked' {
  if (typeof window !== 'undefined' && window.location.hash === '#hotseat') {
    return 'hotseat';
  }
  return import.meta.env.VITE_CLIENT_MODE === 'networked' ? 'networked' : 'hotseat';
}
```

A future "go back to networked from hotseat" flow would just
clear the hash and reload, but adding affordances for that is
out of scope — the route is an escape hatch, not a UI.

### 4. Bundle both shells in `src/App.tsx`

Verify the existing imports are static:

```ts
import { NetworkedShell } from './lobby/NetworkedShell';
import { HotSeatShell } from './hotSeat/HotSeatShell';
// ...
return mode === 'networked' ? <NetworkedShell /> : <HotSeatShell />;
```

If the existing code conditionally dynamic-imports either shell
based on `detectMode()` returning a build-time-resolvable
constant, lift to static. Cost: ~10–20 KB gzipped — bgio's
`Local` transport + the hot-seat board's components — added to
the networked bundle. Tolerable.

The networked build's `VITE_CLIENT_MODE=networked` is still the
default; the runtime hash check is a per-page-load override that
flips the boot decision but doesn't change what's in the bundle.

### 5. `.github/workflows/deploy-pages.yml`

Flip the build step. No env injection needed; the script reads
the config:

```yaml
- name: Build (networked, Render)
  run: npm run build:networked
```

`base: './'` in `vite.config.ts` already keeps the build portable
across whatever path Pages serves it from.

## Acceptance

- `deploy.config.json` exists at repo root with the right values.
- `npm run build:networked` (no env vars set) emits `dist/` with
  the Render URL baked into `dist/assets/*.js` (grep for
  `settlement-server.onrender.com` or whatever the real URL is).
- `VITE_SERVER_URL=http://localhost:8000 npm run build:networked`
  still works for local builds against a local server.
- `npm run dev` (default = hotseat) still mounts the hot-seat
  board with no lobby.
- `npm run dev:full` (networked) still mounts the lobby pointed
  at `http://localhost:8000`.
- Push to `main` → `deploy-pages.yml` runs `build:networked` →
  Pages serves the networked build.
- Visiting `https://jonborchardt.github.io/bgio/` shows
  `<LobbyShell>` (with `<AuthForms>` if not logged in).
- Visiting `https://jonborchardt.github.io/bgio/#hotseat` mounts
  the hot-seat board.
- DevTools → Network: lobby fetches go to the Render hostname,
  not localhost.

## Risks / open questions

- **Config drift.** `pagesUrl` in `deploy.config.json` and
  `ALLOWED_ORIGINS` in `render.yaml` are two places that must
  agree. Plan 03 hardcodes the value in `render.yaml` with a
  comment cross-referencing the config. If the user ever moves
  Pages, they have to remember both. A small CI check could
  enforce this; deferring as gold-plating for V1.
- **Bundle size from both transports.** Real-world cost is
  unknown until measured. If it grows the bundle by more than
  ~30 KB gzipped we should reconsider; below that it's noise.
- **Render URL not yet confirmed.** `https://settlement-server.onrender.com`
  is a best guess. The user should verify in the dashboard
  before this PR merges; until then the placeholder will be in
  the config but the live deploy won't work end-to-end.
- **`#hotseat` and `#cards` / `#mats` / `#boards` / `#fuzz`.**
  The existing dev-shell hashes are honoured in `App.tsx`'s
  early-return logic. Make sure `#hotseat` lands in the same
  switch (or before, since it's a mode override, not a shell
  override). Verify nothing else uses the `#hotseat` literal.
- **Pages CDN cache.** A bundle change can take 5–10 min to
  propagate. Plan 04's smoke says "expect step 1 to be slow on
  first visit after deploy".
- **Custom domain.** If we ever add one, `pagesUrl` here and
  `ALLOWED_ORIGINS` over there both need the new origin added.
  Out of scope for this PR.

## Related

- 03 — `ALLOWED_ORIGINS` is the matching server-side setting and
  must land in the same PR.
- 04 — end-to-end smoke validates this plus the server.
