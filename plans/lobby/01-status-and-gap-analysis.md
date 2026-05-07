# 01 — Status + gap analysis: what's done, what's not for Cloud Run

**Status**: read-only audit
**Effort**: zero (this plan plans nothing — it's the baseline the others
build on)

## TL;DR

The bgio server, lobby, auth, bots, persistence, transports, and Pages
build pipeline are all built. They're wired for **Render**. The only
actually-missing pieces for Cloud Run are:

1. A Cloud Run-flavoured deploy artefact (`cloudbuild.yaml` /
   `service.yaml` / a deploy workflow) — none today.
2. A persistence story that survives Cloud Run's ephemeral filesystem.
   Today's SQLite-on-disk relies on Render's persistent disk.
3. A SocketIO-under-autoscale story (sticky sessions + Redis adapter, or
   pin to one instance).
4. The GitHub Pages publish flips from `build:hotseat` to `build:networked`
   pointed at the Cloud Run URL.
5. CORS / `ALLOWED_ORIGINS` re-pointed at the Pages URL of record.

That's it. Nothing in `src/game/`, `src/lobby/`, or `server/` itself
needs to change for the host swap.

## What is already built (don't redo)

### Server
- [server/index.ts](../../server/index.ts:68-209) — `createServer()` builds
  the bgio `Server`, wires storage, auth hook, idle watcher, bot driver,
  log compaction, trust-proxy.
- [server/start.ts](../../server/start.ts) — `vite-node` boot wrapper used
  by `npm run server:dev` and the Render Dockerfile.
- [server/Dockerfile](../../server/Dockerfile) — multi-stage Node 20 alpine
  image; reusable verbatim on Cloud Run with no edits.
- [server/auth/](../../server/auth/) — register / login / verify routes,
  scrypt password hash, SQLite-backed accounts store, per-IP rate limit,
  `authenticateCredentials` hook for moves.
- [server/bots/botDriver.ts](../../server/bots/botDriver.ts) — server-driven
  bot loop wired via `Server({ bots })`.
- [server/idle/idleWatcher.ts](../../server/idle/idleWatcher.ts) — idle-seat
  takeover sweep (one `setInterval` per server instance).
- [server/storage/](../../server/storage/) — `makeStorage(kind, opts)` over
  bgio's `Async` interface; `'memory' | 'flatfile' | 'sqlite'`. The SQLite
  adapter handles match state + log compaction.
- [server/runs/](../../server/runs/) — run-history store; in-memory by
  default, SQLite-backed when `STORAGE_KIND=sqlite`.

### Client (lobby + transport)
- [src/clientMode.ts](../../src/clientMode.ts) — build-time mode flip via
  `VITE_CLIENT_MODE`; networked client factory wraps bgio's React `Client`
  + `SocketIO({ server: VITE_SERVER_URL })`.
- [src/lobby/lobbyClient.ts](../../src/lobby/lobbyClient.ts) — single
  `LobbyClient` instance pointed at `getServerURL()`.
- [src/lobby/LobbyShell.tsx](../../src/lobby/LobbyShell.tsx) — list / create
  / join / spectate UI on top of `LobbyClient`. Auth-gated.
- [src/lobby/AuthForms.tsx](../../src/lobby/AuthForms.tsx) +
  [authClient.ts](../../src/lobby/authClient.ts) — register / login /
  verify; persists token + minimal user blob in `localStorage`.
- [src/lobby/SeatPicker.tsx](../../src/lobby/SeatPicker.tsx) — seat
  selection grid keyed off bgio's `match.players` array.
- [src/lobby/credentials.ts](../../src/lobby/credentials.ts) — persists
  `(matchID, playerID, credentials)` so a refresh re-mounts the live game.
- [src/App.tsx](../../src/App.tsx:99-189) — `NetworkedShell` decides
  between persisted creds → live `Client` vs lobby UI; spectator path
  with null playerID/credentials handled.

### Build + deploy pipeline (Render-flavoured)
- [scripts/build-networked.mjs](../../scripts/build-networked.mjs) —
  cross-platform `vite build` with `VITE_CLIENT_MODE=networked` and a
  `VITE_SERVER_URL` env passthrough.
- [`npm run build:hotseat` / `build:networked`](../../package.json) — both
  exist, both work.
- [.github/workflows/deploy-pages.yml](../../.github/workflows/deploy-pages.yml)
  — currently builds `hotseat` and publishes to GH Pages.
- [.github/workflows/deploy-server.yml](../../.github/workflows/deploy-server.yml)
  — typecheck + tests + lint on push, gates the Render auto-deploy.
- [render.yaml](../../render.yaml) — Render service config.
- [.env.example](../../.env.example) — full env reference.

## What's missing for a real Cloud Run rollout

Numbered by which plan picks it up. Use this as the checklist for "are we
done?".

### Deploy artefacts (plan 02)
- [ ] No Cloud Run service definition (`service.yaml` or
      `gcloud run deploy` invocation in CI).
- [ ] No `cloudbuild.yaml` for image build, or a corresponding
      `.github/workflows/deploy-cloudrun.yml` that authenticates to GCP
      via Workload Identity Federation and pushes to Artifact Registry.
- [ ] The existing `server/Dockerfile`'s `HEALTHCHECK` line is for local
      docker only — Cloud Run uses its own startup / liveness probes
      defined on the service.
- [ ] `vite-node` runtime works on Cloud Run with no changes; verify
      cold-start time (Render is ~30s on free, Cloud Run gen2 should be
      faster but verify with `--cpu-boost`).

### Persistence (plan 03 — the load-bearing decision)
- [ ] Cloud Run instances have ephemeral filesystem. The current SQLite
      file path `/data/settlement.sqlite` must move to one of:
      a) GCS bucket mounted as a volume (Cloud Run gen2 supports this) +
         pinned `maxScale=1`.
      b) Cloud SQL (Postgres) accessed over the Cloud SQL Auth Proxy /
         Unix socket; replace the SQLite adapter with `bgio-postgres`
         or write a thin Postgres `Async` adapter.
      c) Firestore (no `bgio-firestore` exists in the wild; we'd write
         the `Async` adapter ourselves — not recommended for V1).
- [ ] Accounts + runs stores share the same DB today. Whichever option
      we pick, both modules need to follow.
- [ ] Issue 007 (runs persistence) collapses into this — the migration
      already exists; whichever DB we pick gets the schema.

### Multi-instance readiness (plan 04)
- [ ] SocketIO without a Redis adapter does not propagate moves across
      instances. Today `Server({ ... })` constructs the SocketIO server
      with default settings — no Redis. Two clients in the same match
      hitting different instances would not see each other.
- [ ] In-process state to audit:
      - `botDriver` polling loop (one timer per instance — would
        double-fire under autoscale).
      - `idleWatcher` map of `(matchID, playerID) -> lastActivity`
        (instance-local; activity recorded on instance A is invisible
        on instance B).
      - Auth rate-limit `buckets` map in
        [server/auth/routes.ts](../../server/auth/routes.ts:79) (per-instance
        — caps weaker under autoscale, but this is mitigation, not
        correctness).
      - `compactCompletedMatches` interval (would run N times per
        sweep on N instances; harmless but wasteful).
- [ ] Default plan-03 answer (single SQLite + maxScale=1) sidesteps all
      of these. If we ever go multi-instance, plan 04 is the real work.

### Client (plan 05)
- [ ] [.github/workflows/deploy-pages.yml](../../.github/workflows/deploy-pages.yml:39)
      runs `npm run build:hotseat`. For "users hit GitHub Pages and
      matchmake on the server", this needs to run `build:networked`
      with `VITE_SERVER_URL=<cloud-run-url>` baked in.
- [ ] Or: the SPA grows a runtime mode toggle so a single build can run
      either way. Plan 05 covers both options; default is a single
      networked build.
- [ ] The `getServerURL()` default in
      [src/clientMode.ts](../../src/clientMode.ts:51) is
      `http://localhost:8000`. With the env baked in at build time this
      isn't a problem, but the workflow must pass it through.

### Secrets, CORS, env (plan 06)
- [ ] `ALLOWED_ORIGINS` must include the GH Pages URL the build
      publishes to — and any preview URL pattern we use. The server
      already reads it
      ([server/index.ts](../../server/index.ts:89-99) and
      [auth/routes.ts](../../server/auth/routes.ts:32-54)) — only the
      value changes.
- [ ] The auth tokens today are random strings stored in
      `accountsStore` rather than HMAC-signed. That's fine for V1; if
      we ever go multi-instance with separate token storage the tokens
      would need a signing key from Secret Manager. Out of scope for
      a single-instance Cloud Run.
- [ ] Cloud Run wants env vars at deploy time. Mirror `render.yaml`
      into `service.yaml` (or `--set-env-vars` flags); use Secret
      Manager for anything that wouldn't go in the public repo
      (currently nothing).

### Acceptance + cutover (plan 07)
- [ ] No live test today proves three browser tabs on three networks
      can join the same match and finish a round end-to-end. The
      `tests/e2e/smoke.spec.ts` covers hot-seat. Plan 07 adds the
      networked smoke (or escalates issue 025).
- [ ] Decide: keep Render running in parallel for a release or two as
      a fallback, or cut over hard.

## Files this plan references but does not change

This is a read-only audit. No file edits. The first plan that writes
code is 02.
