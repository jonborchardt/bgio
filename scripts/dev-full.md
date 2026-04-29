# `npm run dev:full`

One-command bootstrap for the local "client + server + storage" experience
(12.7).

## What it does

`concurrently -n server,client -c blue,green ...` runs two processes in
the same terminal with prefixed, color-tagged output:

- **server** (`vite-node --watch server/start.ts`) — bgio Koa server
  on `:8000`. vite-node restarts it on `server/**` or `src/game/**`
  changes (the same files the production server bundles). The
  runner is `vite-node`, not `tsx`, because tsx 4.x cannot resolve
  bgio's subpath imports — full rationale in
  [`server/Dockerfile`](../server/Dockerfile)'s header.
- **client** (`vite`) — Vite dev server on `:5179` with HMR. Serves
  the React app the same way `npm run dev` does.

A pre-hook runs `node scripts/free-ports.mjs 5179 8000` to clear
any stale process listening on either port before `concurrently`
fires; without that, a leftover Vite from a previous session
would crash-exit the new client because the Vite config sets
`strictPort: true` (Playwright targets the fixed port).

`Ctrl+C` kills both — `concurrently`'s default `--kill-others-on-fail`
behavior plus the SIGINT propagation handles teardown.

## Networked mode

`dev:full` is most useful when the client is in networked mode (so it
talks to the server). Set:

```
VITE_CLIENT_MODE=networked
VITE_SERVER_URL=http://localhost:8000
```

in `.env.local`. With `VITE_CLIENT_MODE=hotseat` the server runs but
the client never reaches it — running just `npm run dev` is simpler in
that case.

## Storage

The dev SQLite file lives at `.dev-data/settlement.sqlite` (configured
via `SQLITE_PATH` in `.env.example`). The directory is gitignored.
Delete the file to start fresh.

## First-time login

`npm run dev:seed` creates two dev accounts (idempotent):

- `alice` / `password`
- `bob` / `password`

Re-running is a no-op when the accounts already exist.

## Logs

The `concurrently -n server,client -c blue,green` flags prefix each
line with the process name and color. If you only want one stream,
run `npm run dev:server` or `npm run dev` directly.
