# Settlement server

This directory hosts the boardgame.io networked server. The static SPA at
the repo root can be built two ways (`npm run build:hotseat` /
`npm run build:networked`); networked mode talks to this server.

## Local dev

```bash
npm install
npm run dev:server     # tsx server/index.ts on PORT=8000
npm run dev:full       # client + server in one terminal
```

By default `STORAGE_KIND` is `memory` (no on-disk persistence). For
SQLite-backed local dev set:

```bash
STORAGE_KIND=sqlite SQLITE_PATH=./.dev-data/settlement.sqlite npm run dev:server
```

`better-sqlite3` is a runtime dep; the very first `npm install` after pulling
this directory builds its native module. If install ever fails to compile,
the storage factory falls back to in-memory (with a console warning) so dev
continues to work.

## Deploy: Render

The production server runs on **[Render](https://render.com)**'s free tier.
The deploy is git-driven via [`render.yaml`](../render.yaml) — pushing to
`main` rebuilds and redeploys the `settlement-server` service.

First-time setup:

1. In the Render dashboard: **New** → **Blueprint** → point at this repo.
2. Render reads [`render.yaml`](../render.yaml) and provisions:
   - A Docker web service built from [`server/Dockerfile`](Dockerfile).
   - A 1GB persistent disk mounted at `/data`.
   - Env vars: `STORAGE_KIND=sqlite`, `SQLITE_PATH=/data/settlement.sqlite`,
     `NODE_ENV=production`.
3. Wait for the first deploy. The service URL becomes the
   `VITE_SERVER_URL` you bake into the networked SPA build.

The CI workflow [`deploy-server.yml`](../.github/workflows/deploy-server.yml)
runs on every push to `main` that touches server-relevant paths and fails
the build loudly if the server typecheck breaks — Render won't deploy a
broken server because the typecheck blocks merge first.

### Environment variables

| Var            | Default                       | Notes                                                 |
| -------------- | ----------------------------- | ----------------------------------------------------- |
| `PORT`         | `8000`                        | Render injects this; do not override in the dashboard. |
| `STORAGE_KIND` | `memory`                      | Set to `sqlite` for persistence (Render does this).   |
| `SQLITE_PATH`  | `./.dev-data/settlement.sqlite` | On Render, `/data/settlement.sqlite`.                 |
| `NODE_ENV`     | (unset)                       | Render sets `production`.                             |

### Free-tier sleep

Render's free web services sleep after ~15 min idle and take ~30s to
wake. The 10.6 client backoff handles this transparently — first visitor
of the day eats the cold start; subsequent traffic is warm. If sleep ever
hurts in real use, upgrading the service plan is a config change, not a
rewrite.

### Secrets

This service does not currently require any secrets. When account-related
deploys (10.7) need email/SMTP or OAuth secrets, add them via the Render
dashboard's **Environment** tab — they are not committed to `render.yaml`.
