# Lobby + networked-deploy plan — Cloud Run target

This subdirectory plans the work to ship a real networked Settlement: a single
bgio server that anyone hitting the GitHub Pages client uses for matchmaking,
join, and play.

The user asked for **Google Cloud Run** as the server host. The repo today is
already wired for **Render** — Dockerfile, `render.yaml`, server-side bgio
`Server`, lobby UI, accounts, SQLite. Most of the bgio surface is already
built. The Cloud Run-specific work is the deploy target, the storage choice
(Cloud Run's filesystem is ephemeral and may be multi-instance), and the
GitHub Pages client build.

## Direct answers to the questions

1. **Is this done?** Server + lobby + auth + bots + SocketIO transport + match
   storage are built and deployed (see [01-status-and-gap-analysis.md]). What
   is **not** done for Cloud Run specifically:
   - No Cloud Run Dockerfile / `cloudbuild.yaml` / deploy workflow.
   - The current persistence is SQLite on a 1 GB persistent disk (Render
     specific). Cloud Run's filesystem is ephemeral and instances can be
     recycled at any time — SQLite-on-disk does not survive without a
     mounted volume or an external DB.
   - GitHub Pages currently publishes the **hot-seat** build, not the
     networked one. The Pages workflow needs to switch (or the client needs
     a runtime mode toggle).
   - SocketIO under multi-instance autoscale needs sticky sessions + a Redis
     adapter, or the service must be pinned to one instance.

2. **The boardgame.io way.** Already chosen, already in the codebase:
   - `Server({ games, db, origins, authenticateCredentials, bots })` from
     `boardgame.io/server` — see [server/index.ts](../../server/index.ts).
   - `LobbyClient` from `boardgame.io/client` for REST (list / create / join
     / leave) — see [src/lobby/lobbyClient.ts](../../src/lobby/lobbyClient.ts).
     The lobby UI deliberately renders our own MUI shell on top of
     `LobbyClient` rather than bgio's stock `<Lobby>` (rationale documented
     in [LobbyShell.tsx](../../src/lobby/LobbyShell.tsx)).
   - `SocketIO` transport from `boardgame.io/multiplayer` for the live
     match — see [src/clientMode.ts](../../src/clientMode.ts).
   - bgio's `Async` storage interface for the DB; an in-memory, FlatFile,
     and SQLite adapter are already wired through `STORAGE_KIND` —
     [server/storage/index.ts](../../server/storage/index.ts).
   - Server-driven bots via `Server({ bots })` and per-game
     `ai.enumerate(G, ctx, playerID)` — [server/bots/botDriver.ts](../../server/bots/botDriver.ts).

   Conclusion: **don't reinvent any of these on Cloud Run.** The whole
   point of the bgio bet (per CLAUDE.md "Use boardgame.io when reasonable")
   is that the engine, lobby REST, transport, and bot loop are not what we
   change between hosts. Only the deploy + persistence seam moves.

3. **Plans.** This folder. Read in order; each later plan depends on
   decisions made in the earlier ones.

## Index

| # | File | Topic |
|---|---|---|
| 01 | [status-and-gap-analysis](01-status-and-gap-analysis.md) | What works today, what's missing for Cloud Run |
| 02 | [cloud-run-deploy](02-cloud-run-deploy.md) | Cloud Run service config (image, env, healthcheck, websockets) |
| 03 | [storage-on-cloud-run](03-storage-on-cloud-run.md) | The load-bearing decision: SQLite + GCS volume, or Cloud SQL Postgres |
| 04 | [multi-instance-readiness](04-multi-instance-readiness.md) | Socket.IO + in-process state under autoscale |
| 05 | [pages-publishes-networked-client](05-pages-publishes-networked-client.md) | Flip GH Pages to networked, point at Cloud Run |
| 06 | [secrets-cors-and-env](06-secrets-cors-and-env.md) | Secret Manager, CORS allow-list, token signing |
| 07 | [acceptance-and-rollout](07-acceptance-and-rollout.md) | End-to-end smoke, rollback, render-vs-cloudrun decision |

## Recommended order

The minimum end-to-end shipping path is:

1. **03 storage decision** first — until we know whether Cloud Run hosts
   SQLite-on-volume (single instance) or Cloud SQL Postgres (multi
   instance), every later plan branches.
2. **04 multi-instance readiness** — falls out of 03; if 03 picks
   single-instance SQLite then 04 mostly says "pin maxScale=1 and audit
   in-process state".
3. **02 Cloud Run deploy** — the actual service config, depends on 03/04.
4. **06 secrets / CORS / env** — small follow-up to 02.
5. **05 Pages → networked** — independent of server work; can land in
   parallel with 02–04 as long as `VITE_SERVER_URL` is parameterised.
6. **07 acceptance + rollout** — the smoke + decision on whether to keep
   Render in parallel.

## Stance questions to confirm before implementing

These are the load-bearing choices. Each later plan defaults to one answer
but flags the alternative.

- **Render vs Cloud Run vs both?** This plan defaults to "Cloud Run replaces
  Render". Keeping both running is wasted complexity; keeping Render around
  as a fallback for a release or two is reasonable. Plan 07 covers the
  cutover.
- **SQLite-on-volume vs Cloud SQL Postgres?** Default: **SQLite + GCS
  volume mount + maxInstances=1**. It's the smallest delta from today and
  matches the project's "V1 networked playtest" stance — there is no real
  user load yet. Plan 03 covers the Postgres path for when load grows.
- **Single Pages networked build vs runtime mode toggle?** Default: **single
  networked build**. The hot-seat build can stay reachable at a separate
  URL (Pages preview branch, or `?mode=hotseat`). Plan 05 covers both.

## Out of scope here

- Game balance, content tagging, or any `src/game/` change. Networked
  doesn't change the game.
- Replacing `LobbyShell` with bgio's stock `<Lobby>` — already documented
  as a deliberate deviation.
- Match search / friends / invitations / private matches. The current
  lobby is "list all matches, click one, pick a seat". Anything richer is
  post-V1.
- Spectator UX polish; the spectator path works (10.8) and the lobby
  surfaces a "Watch" button. Visual polish is in `issues/` not here.

## Related issues (already filed under `plans/`)

- [001](../issue-001-render-yaml-missing.md) — Render blueprint (already
  closed; Cloud Run plan supersedes if we cut over).
- [002](../issue-002-match-moves-not-authenticated.md) — auth hook (closed).
- [003](../issue-003-bgio-server-missing-bots-config.md) — bots config (closed).
- [006](../issue-006-cors-origins-missing.md) — CORS (closed). Cloud Run
  changes the value of `ALLOWED_ORIGINS` but not the mechanism.
- [007](../issue-007-runs-persistence-in-memory.md) — runs history
  persistence (open). Plan 03 absorbs this since it's the same DB
  decision.
- [022](../issue-022-sqlite-migrations-no-version-table.md) — migrations
  hygiene; relevant if 03 sticks with SQLite.
- [025](../issue-025-ci-no-networked-e2e.md) — networked smoke in CI; plan
  07 picks this up.
