# 13 — Deployment & persistence

> **Status: done** (all sub-plans landed; see
> [STATUS.md](STATUS.md) for the canonical per-row state).
> Pre-deploy step on a fresh host: `npm install` so the native
> `better-sqlite3` build runs. Render free-tier sleep is accepted;
> the 10.6 reconnect spinner covers wake.

## Goal

Ship two deployment modes; **networked is the headline**, hot-seat is
preserved as a fallback / link-and-share demo.

1. **Networked multiplayer (primary)** — the bgio server from stage 10
   hosted on **Render**, with SQLite-on-disk storage.
2. **Hot-seat (ephemeral demo only)** — static SPA on GitHub Pages,
   already works today (see
   [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml)).
   Keep it green so the project always has a no-server demo URL — but
   note this build does **not** record runs and does not require login.
   It is for "look at this thing" link-sharing, not for the canonical
   experience.

## Scope

**In:**
- Keep the existing `deploy-pages.yml` working through every gameplay stage.
  The workflow builds the SPA and deploys; nothing about networking lives
  in that path.
- **Host: Render.** Decision locked in (see
  [13.2](13.2-server-deploy-target.md)). Reasons: persistent disk,
  push-from-git, lowest ops footprint.
- **Database: SQLite via `better-sqlite3`** (see
  [13.3](13.3-database-choice.md)). Postgres migration path is preserved
  via the `Storage` interface from
  [10.4](10.4-storage.md), but not done in V1.
- Document the build-time switch between the two modes
  (env var, conditional `App.tsx` import).

**Out:**
- A staging environment. Add only if the project warrants it.
- CDN / caching tuning beyond what GitHub Pages gives us.

## Depends on

10 (server, storage), 12 (CI green) — the deploy is the *output* of those
stages.

## Sub-plans

- `13.1-static-build-modes.md` — env var to toggle hot-seat vs networked
  client at build time; wired into `vite.config.ts`.
- `13.2-server-deploy-target.md` — pick host; create a Dockerfile; write
  a deploy workflow.
- `13.3-database-choice.md` — pick db; write the storage adapter from
  10.4 against it.
- `13.4-pages-deploy-keep-alive.md` — assert the existing GH Pages build
  still works after each stage; add to CI.

## Test surface

- The static build under `vite build` produces a `dist/` that runs in
  hot-seat mode without any server.
- The server deploy passes a smoke test: spin up, host a match, two
  clients connect, play a round, disconnect, reload state from storage.
