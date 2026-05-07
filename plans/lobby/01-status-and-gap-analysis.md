# 01 — Status + gap analysis: what's done, what's actually missing

**Status**: read-only audit
**Effort**: zero (this plan plans nothing — it's the baseline the
others build on)

## TL;DR

The bgio server, lobby, auth, bots, persistence, transports, build
pipeline, **and Render deploy** are all built and live. Per CLAUDE.md
"Networked playtest is unverified end-to-end" — meaning bytes are
deployed but no human has driven the live combo through a real round.

The actually-missing pieces, in priority order:

1. GitHub Pages publishes the **hot-seat** build, not the networked
   build pointed at the Render service URL. Plan 02.
2. `ALLOWED_ORIGINS` on the Render service is `sync: false` and
   (almost certainly) unset — so the lobby will fail CORS for every
   `fetch` from the deployed Pages URL. Plan 03.
3. `TRUST_PROXY` is not set on Render at all. Without it, the auth
   rate limiter sees Render's edge IP for every request and collapses
   into one bucket. Plan 03.
4. No live test today proves three browser tabs across two networks
   can join the same match and finish a round end-to-end. Plan 04.

That's it. Nothing in `src/game/`, `src/lobby/`, or `server/` itself
needs to change for this rollout.

## What is already built (don't redo)

### Server
- [server/index.ts](../../server/index.ts:68-209) — `createServer()`
  builds the bgio `Server`, wires storage, auth hook, idle watcher,
  bot driver, log compaction, trust-proxy.
- [server/start.ts](../../server/start.ts) — `vite-node` boot wrapper
  used by `npm run server:dev` and the Render Dockerfile.
- [server/Dockerfile](../../server/Dockerfile) — multi-stage Node 20
  alpine image; what Render pulls and runs.
- [server/auth/](../../server/auth/) — register / login / verify
  routes, scrypt password hash, SQLite-backed accounts store, per-IP
  rate limit, `authenticateCredentials` hook for moves.
- [server/bots/botDriver.ts](../../server/bots/botDriver.ts) —
  server-driven bot loop wired via `Server({ bots })`.
- [server/idle/idleWatcher.ts](../../server/idle/idleWatcher.ts) —
  idle-seat takeover sweep.
- [server/storage/](../../server/storage/) — `makeStorage(kind, opts)`
  over bgio's `Async` interface; `'memory' | 'flatfile' | 'sqlite'`.
  The SQLite adapter handles match state + log compaction.
- [server/runs/](../../server/runs/) — run-history store; in-memory
  by default, SQLite-backed when `STORAGE_KIND=sqlite`.

### Client (lobby + transport)
- [src/clientMode.ts](../../src/clientMode.ts) — build-time mode flip
  via `VITE_CLIENT_MODE`; networked client factory wraps bgio's
  React `Client` + `SocketIO({ server: VITE_SERVER_URL })`.
- [src/lobby/lobbyClient.ts](../../src/lobby/lobbyClient.ts) — single
  `LobbyClient` instance pointed at `getServerURL()`.
- [src/lobby/LobbyShell.tsx](../../src/lobby/LobbyShell.tsx) — list /
  create / join / spectate UI on top of `LobbyClient`. Auth-gated.
- [src/lobby/AuthForms.tsx](../../src/lobby/AuthForms.tsx) +
  [authClient.ts](../../src/lobby/authClient.ts) — register / login /
  verify; persists token + minimal user blob in `localStorage`.
- [src/lobby/SeatPicker.tsx](../../src/lobby/SeatPicker.tsx) — seat
  selection grid keyed off bgio's `match.players` array.
- [src/lobby/credentials.ts](../../src/lobby/credentials.ts) —
  persists `(matchID, playerID, credentials)` so a refresh re-mounts
  the live game.
- [src/App.tsx](../../src/App.tsx:99-189) — `NetworkedShell` decides
  between persisted creds → live `Client` vs lobby UI; spectator path
  with null playerID/credentials handled.

### Build + deploy pipeline
- [scripts/build-networked.mjs](../../scripts/build-networked.mjs) —
  cross-platform `vite build` with `VITE_CLIENT_MODE=networked` and
  a `VITE_SERVER_URL` env passthrough.
- [`npm run build:hotseat` / `build:networked`](../../package.json) —
  both exist, both work.
- [.github/workflows/deploy-pages.yml](../../.github/workflows/deploy-pages.yml)
  — currently builds `hotseat` and publishes to GH Pages.
- [.github/workflows/deploy-server.yml](../../.github/workflows/deploy-server.yml)
  — typecheck + tests + lint on push, gates the Render auto-deploy.
- [render.yaml](../../render.yaml) — Render service config: free
  plan, Oregon region, Docker, persistent 1 GB disk at `/data`,
  SQLite, healthcheck `/games`, `autoDeploy: true`.
- [.env.example](../../.env.example) — full env reference.

## What's actually missing

Numbered by which plan picks it up. Use this as the checklist for
"are we done?".

### Pages publishes the wrong build (plan 02)

- [ ] [.github/workflows/deploy-pages.yml:39](../../.github/workflows/deploy-pages.yml)
      runs `npm run build:hotseat`. For "users hit GitHub Pages and
      matchmake on the server", it must run `build:networked` with
      `VITE_SERVER_URL=<render-url>` baked in.
- [ ] The `getServerURL()` default in
      [src/clientMode.ts:50-52](../../src/clientMode.ts) is
      `http://localhost:8000`. With the env baked in at build time
      this isn't a problem — but the workflow must pass it through.
- [ ] Hot-seat fate: pick one of {drop entirely, `#hotseat` route,
      separate `hotseat-pages` branch}. Plan 02 covers each.

### CORS + proxy env on Render (plan 03)

- [ ] [render.yaml:35](../../render.yaml) declares
      `ALLOWED_ORIGINS` with `sync: false` — meaning the value is
      set in the Render dashboard manually. **Almost certainly
      unset right now.** When unset, the server falls back to
      `http://localhost:5179` only
      ([server/index.ts:97-99](../../server/index.ts)) and rejects
      the live Pages origin.
- [ ] [render.yaml](../../render.yaml) does **not** declare
      `TRUST_PROXY`. The server defaults to `false`
      ([server/index.ts:121-129](../../server/index.ts)). On Render
      every request appears to come from the edge IP, so
      [server/auth/routes.ts:228](../../server/auth/routes.ts)'s
      rate limiter buckets all attackers together. Issue 023 was
      fixed in code; the env wiring is the missing half.

### Live smoke (plan 04)

- [ ] No human has driven the live combo through a full round.
      Plan 04 ships the 15-step manual gate.
- [ ] No automated smoke against the live combo (issue 025
      is the open follow-up).

## Deferred — out of scope here, noted for honesty

Render free tier is single-instance, and we're staying on it for
V1. The following only matter if/when we move to a paid plan with
multiple instances:

- **SocketIO without a Redis adapter does not propagate moves
  across instances.** Two clients in the same match hitting
  different processes would not see each other.
- **Bot driver and idle watcher fire from every instance.** Both
  use `setInterval` per process; under autoscale the bot timer
  duplicates work and the idle watcher's per-process activity map
  diverges (real correctness bug — a player active on instance A
  looks idle on instance B and gets handed to a bot).
- **Auth rate-limit buckets are per-process.** With N instances
  the effective cap is `BUCKET_CAPACITY / N`.

If we ever lift the single-instance assumption, the playbook is:
`@socket.io/redis-adapter` for SocketIO, a distributed lock or
cron-driven runner for the bot + idle loops, Redis-backed token
buckets for auth. None of that is needed now.

## Files this plan references but does not change

This is a read-only audit. No file edits. The first plan that
writes code is 02.
