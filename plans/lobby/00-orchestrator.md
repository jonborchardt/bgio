# Lobby + networked-deploy plan — Render target

This subdirectory plans the work to ship a real networked Settlement: a
single bgio server, hosted on **Render**, that anyone hitting the
GitHub Pages client uses for matchmaking, join, and play.

The repo is already wired for Render. [render.yaml](../../render.yaml)
provisions a Docker web service, [server/Dockerfile](../../server/Dockerfile)
builds the image, [.github/workflows/deploy-server.yml](../../.github/workflows/deploy-server.yml)
gates the auto-deploy with typecheck + tests + lint, and SQLite lives
on a 1 GB persistent disk at `/data`. The server holds accounts, the
SocketIO transport, lobby REST, server-side bots, idle-watcher, and
log compaction. Per CLAUDE.md the Render service is **deployed but
unverified end-to-end** — no human has logged in from the live Pages
URL and played a real round.

This plan is the rest: flip Pages to publish the networked client,
point it at the Render service, set the matching CORS env, and run
the smoke that proves it works.

## Direct answers to the questions

1. **Is this done?** Server + lobby + auth + bots + SocketIO transport
   + match storage are built and deployed (see [01-status-and-gap-analysis](01-status-and-gap-analysis.md)).
   What's **not** done:
   - GitHub Pages currently publishes the **hot-seat** build, not the
     networked one pointed at the Render service.
   - The Render service's `ALLOWED_ORIGINS` env var is `sync: false`
     in `render.yaml` (intentionally — the value depends on the Pages
     URL of record). Until it includes the Pages URL, the live lobby
     will silently fail with CORS errors on every fetch.
   - `TRUST_PROXY=true` is not set in `render.yaml`; without it, the
     auth rate limiter collapses every attacker into one bucket
     (issue 023's old bug).
   - No live test has driven the auth → create match → join → play a
     round path on the live combo.

2. **The boardgame.io way.** Already chosen, already in the codebase:
   - `Server({ games, db, origins, authenticateCredentials, bots })`
     from `boardgame.io/server` — see [server/index.ts](../../server/index.ts).
   - `LobbyClient` from `boardgame.io/client` for REST (list / create
     / join / leave) — see [src/lobby/lobbyClient.ts](../../src/lobby/lobbyClient.ts).
     The lobby UI deliberately renders our own MUI shell on top of
     `LobbyClient` rather than bgio's stock `<Lobby>` (rationale in
     [LobbyShell.tsx](../../src/lobby/LobbyShell.tsx)).
   - `SocketIO` transport from `boardgame.io/multiplayer` for the live
     match — see [src/clientMode.ts](../../src/clientMode.ts).
   - bgio's `Async` storage interface for the DB; in-memory, FlatFile,
     and SQLite adapters are already wired through `STORAGE_KIND` —
     [server/storage/index.ts](../../server/storage/index.ts).
   - Server-driven bots via `Server({ bots })` and per-game
     `ai.enumerate(G, ctx, playerID)` —
     [server/bots/botDriver.ts](../../server/bots/botDriver.ts).

   Conclusion: don't reinvent any of these. The whole point of the
   bgio bet (per CLAUDE.md "Use boardgame.io when reasonable") is
   that the engine, lobby REST, transport, and bot loop don't change
   between hosts.

3. **Plans.** Four sub-plans, read in order. Each is small now that
   the host is Render — the heavy infra work (Cloud Run service spec,
   storage volume mount, multi-instance scaling) is gone.

## Index

| # | File | Topic |
|---|---|---|
| 01 | [status-and-gap-analysis](01-status-and-gap-analysis.md) | What works today, what's actually missing |
| 02 | [pages-publishes-networked-client](02-pages-publishes-networked-client.md) | Flip GH Pages to networked, point at Render |
| 03 | [cors-and-env](03-cors-and-env.md) | `ALLOWED_ORIGINS` + `TRUST_PROXY` on Render |
| 04 | [acceptance-and-smoke](04-acceptance-and-smoke.md) | Manual + automated smoke against live combo |

## Decisions already locked

These were the open stance questions; the user answered them, so
they're documented here as load-bearing inputs to plans 02–04.

- **Single source of truth for URLs:** a checked-in
  `deploy.config.json` at the repo root, holding
  `renderServerUrl` and `pagesUrl`. The build script reads it; the
  `render.yaml` mirrors `pagesUrl`'s origin in `ALLOWED_ORIGINS` (with
  a cross-reference comment). No GitHub Actions repo variables.
- **Pages URL of record:** `https://jonborchardt.github.io/bgio/`
  (origin: `https://jonborchardt.github.io`). Stored in
  `deploy.config.json#pagesUrl`; the bare origin is what
  `ALLOWED_ORIGINS` uses.
- **Hot-seat in prod = yes.** The Pages bundle ships **both** modes.
  Default visit (`/`) → networked lobby. Visiting
  `/#hotseat` mounts the hot-seat shell regardless of build mode.
  Implemented as a runtime toggle in [src/clientMode.ts](../../src/clientMode.ts);
  the networked build statically imports both shells so both
  transports end up in the bundle (~10–20 KB gzipped cost). Local dev
  is unchanged — `npm run dev` still picks mode from
  `VITE_CLIENT_MODE` at build time.
- **Server env path:** Path A — both `ALLOWED_ORIGINS` and
  `TRUST_PROXY=true` are committed in `render.yaml` (neither is a
  secret).
- **Pages workflow trigger:** ship 02 + 03 in one PR, push to `main`,
  let the existing auto-deploy fly. No `workflow_dispatch` gating.

The one open input that still needs your eyes: the **exact Render
service URL.** `render.yaml` names the service `settlement-server`,
so it's most likely `https://settlement-server.onrender.com`, but
Render sometimes appends a hash. Before merging, verify from the
Render dashboard and put the real value in `deploy.config.json#renderServerUrl`.

## Recommended order

The minimum end-to-end shipping path:

1. **02 + 03 land in one PR.** Plan 02 adds `deploy.config.json`,
   wires `build-networked.mjs` to read it, flips
   `deploy-pages.yml` to `build:networked`, adds the `#hotseat`
   runtime toggle. Plan 03 adds `TRUST_PROXY=true` and the
   `ALLOWED_ORIGINS` value to `render.yaml`.
2. After merge, both `deploy-pages.yml` (auto-runs on push) and
   Render's blueprint sync (auto-runs on push) re-roll. Pages
   publishes the networked build; Render restarts with the new
   env. The cutover is the merge.
3. **04 acceptance-and-smoke** — manual smoke (15 steps + the
   `#hotseat` step) on the live combo immediately after the
   deploys land. Automated smoke deferred to issue 025.

## Out of scope here

- Game balance, content tagging, or any `src/game/` change.
  Networked doesn't change the game.
- Replacing `LobbyShell` with bgio's stock `<Lobby>` — already
  documented as a deliberate deviation.
- Match search / friends / invitations / private matches. The
  current lobby is "list all matches, click one, pick a seat".
  Anything richer is post-V1.
- Spectator UX polish; the spectator path works (10.8) and the
  lobby surfaces a "Watch" button. Visual polish is in `issues/`
  not here.
- Multi-instance scaling. Render free tier is single-instance and
  the V1 stance is "playtest, not load test"; bgio's SocketIO room
  map and the in-process bot/idle timers all assume one process.
  If we ever upgrade to a paid plan with `> 1` instances we'll
  need a Redis adapter for SocketIO and a single-leader story for
  the timers — out of scope here, noted in 01 for posterity.
- A custom domain in front of the Render service. Trivial later;
  out of scope now. The Render `*.onrender.com` URL is fine for V1.

## Related issues (already filed under `plans/`)

- [001](../issue-001-render-yaml-missing.md) — Render blueprint
  (closed; this plan builds on it).
- [002](../issue-002-match-moves-not-authenticated.md) — auth hook (closed).
- [003](../issue-003-bgio-server-missing-bots-config.md) — bots config (closed).
- [006](../issue-006-cors-origins-missing.md) — CORS env wiring
  (closed in code; plan 03 here is "set the actual value").
- [007](../issue-007-runs-persistence-in-memory.md) — runs history
  persistence (closed by SQLite-runs-store; SQLite + persistent
  disk on Render keeps it durable).
- [022](../issue-022-sqlite-migrations-no-version-table.md) —
  migrations hygiene; still relevant if we ever add a schema
  change to the SQLite store.
- [023](../issue-023-auth-rate-limit-unbounded.md) — rate limit
  bug `TRUST_PROXY=true` mitigates; plan 03 sets it.
- [025](../issue-025-ci-no-networked-e2e.md) — networked smoke in
  CI; plan 04 picks this up.
