# Settlement (codename)

A four-role co-op-ish strategy game built on **[boardgame.io](https://boardgame.io/)** +
**React** + **TypeScript** + **Vite**, with a sibling **Koa** server under `server/` for
networked play.

> **Status: V1 engine + UI complete; hot-seat single-tab end-to-end playable.**
> 490+ tests, typecheck + lint clean, Playwright smoke green. The hot-seat board ships
> a seat-picker tab strip, per-role "End my turn" buttons, a `ctx.activePlayers`-driven
> "Player N: role's turn" header, a phase hint, a game-over banner, a favicon, and a
> per-event damage absorber UI for Foreign battles. Per-seat resources live on a player
> mat (`in` / `out` / `stash`); the chief sweeps `out` into the bank at every chief
> turn, drops resources into seats' `in`, and `in` empties into `stash` automatically
> when a seat begins its turn. Domestic produce auto-fires at othersPhase entry. The
> networked stack assembles end-to-end (lobby + accounts + chat + idle bot takeover)
> but the live two-tab playtest hasn't been driven through yet.

## Two ways to play

- **Demo at the GitHub Pages URL** — hot-seat, single-tab, no save, no login. Pick a seat
  from the tab strip and play all four roles from one browser; the bgio debug panel is
  also mounted in dev (production build hides it). Round-loop reachable end-to-end.
- **Full experience with accounts and run history** runs against the networked Render
  deploy. See [`server/README.md`](server/README.md) for env vars + Render setup.

For a local full-stack loop while developing:

```bash
npm install
npm run dev:full   # boots server (:8000) + client (:5179) via concurrently
```

## Getting started

```bash
npm install         # required - includes native better-sqlite3 build
npm run dev         # Vite dev server (hot-seat client) on :5179
npm run server:dev  # vite-node server/start.ts — bgio Koa server on :8000
npm run dev:full    # one command for both above

npm run build       # tsc -b + vite build → dist/ (default = hot-seat)
npm run build:hotseat
npm run build:networked  # SocketIO transport, talks to VITE_SERVER_URL

npm test
npm run test:coverage    # gate: 80 lines / 85 functions / 70 branches
npm run e2e:smoke        # Playwright smoke
npm run typecheck
npm run lint
```

Requires Node 20+. `npm install` builds `better-sqlite3` natively; on bare hosts you need
Python 3 / make / a C++ toolchain. The Dockerfile installs them automatically.

## Layout

```
.
├── index.html
├── src/
│   ├── main.tsx               # React root
│   ├── App.tsx                # picks hot-seat vs networked client at boot
│   ├── Board.tsx              # board shell + role-panel host
│   ├── clientMode.ts          # detectMode, getServerURL, networkedClientFactory
│   ├── theme.ts               # MUI palette + role / resource / tier / event tokens
│   ├── game/                  # bgio Game definition (engine, no React)
│   │   ├── index.ts           # Settlement export
│   │   ├── types.ts           # SettlementState, role / phase / stage enums
│   │   ├── setup.ts moves.ts random.ts hooks.ts playerView.ts endConditions.ts
│   │   ├── roles.ts           # assignRoles / seatOfRole / rolesAtSeat
│   │   ├── phases/            # chief / others / endOfRound / stages
│   │   ├── resources/         # bag / bank / centerMat / playerMat / bankLog / moves / types
│   │   ├── events/            # event deck, dispatcher, eventResolve
│   │   ├── opponent/          # wander deck
│   │   ├── tech/              # tech-card effects
│   │   ├── ai/                # enumerate + per-role bot heuristics
│   │   └── roles/{chief,science,domestic,foreign}/  # per-role moves
│   ├── data/                  # JSON + typed loaders (BUILDINGS / UNITS / TECHNOLOGIES / EVENT_CARDS / WANDER_CARDS / ADJACENCY_RULES / SCIENCE_CARDS / battle / trade decks)
│   ├── ui/                    # MUI panels + cards + chat + chrome
│   │   ├── layout/            # StatusBar, SeatPicker, RolePanel, GameOverBanner, PhaseHint
│   │   ├── chief/ science/ domestic/ foreign/   # per-role panels
│   │   ├── cards/ resources/ mat/ deck/ hand/ chat/
│   │   └── ...
│   ├── lobby/                 # LobbyShell + SeatPicker + AuthForms + soloConfig + creds
│   └── replay/                # MoveLog + recorder + replay view
├── server/
│   ├── index.ts               # Koa Server + auth routes + idle watcher
│   ├── auth/{accounts,passwordHash,middleware,routes}.ts
│   ├── runs/runs.ts
│   ├── idle/{idleWatcher,seatTakeover}.ts
│   ├── storage/{index,sqlite}.ts + migrations/
│   ├── README.md              # Render deploy notes
│   └── Dockerfile
├── tests/                     # mirror of src/
│   ├── helpers/{makeClient,runMoves,seed,factories,seeds}.ts
│   └── ...
├── tests-e2e/smoke.spec.ts    # Playwright
├── scripts/                   # dev-seed.ts, build-networked.mjs, free-ports.mjs
├── .github/workflows/         # ci.yml, deploy-pages.yml, deploy-server.yml
├── render.yaml                # Render blueprint (free-tier docker + persistent disk)
├── vite.config.ts             # Vite + Vitest config (port 5179 strict)
├── playwright.config.ts
└── eslint.config.js           # bans Math.random in src/
```

## History

The repo carries a `plans/` directory with the historical execution playbook + the
sub-plan files that drove each commit. It's purely archival now — every shipped piece
is reflected in [`CLAUDE.md`](CLAUDE.md), the file headers under `src/`, and the test
suite. Numeric tags in source-file headers (e.g. `// 14.1 — seat picker`) point at the
sub-plan that introduced the slice; the plan files themselves can be deleted without
breaking the build, the tests, or the deploys.

## Deploying

- **Hot-seat (GH Pages):** push to `main` → `.github/workflows/deploy-pages.yml` builds
  the hot-seat bundle and deploys. Settings → Pages → Source: GitHub Actions, the first
  time.
- **Networked (Render):** `render.yaml` describes a docker web service with a 1 GB
  persistent disk for the SQLite DB. `.github/workflows/deploy-server.yml` validates the
  server build on each push; Render auto-deploys from the repo. Free-tier sleeps after
  ~15 min idle (~30s wake); the lobby reconnect spinner covers it.

The Vite config uses `base: './'`, so the built site works regardless of the repo name.
