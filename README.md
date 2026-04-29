# Settlement (codename)

A four-role co-op-ish strategy game built on **[boardgame.io](https://boardgame.io/)** +
**React** + **TypeScript** + **Vite**, with a sibling **Koa** server under `server/` for
networked play.

> **Status: V1 engine + UI scaffolding complete; hot-seat single-tab end-to-end playable.**
> Stages 01-13 are `done` (471+ tests, typecheck + lint clean, Playwright smoke green).
> Stage 14 (post-V1 playtest follow-ups) is in progress: 14.1 (seat picker), 14.2 (per-role
> "End my turn" moves), 14.3 (mode tag + center-mat dedup), 14.5 (game-over banner), 14.6
> (phase hints), 14.7 (chat hidden in hot-seat), 14.8 (favicon), 14.9 (this README pass),
> and 14.12 (active-seat header) all landed; see
> [`plans/14-playtest-followups.md`](plans/14-playtest-followups.md) for the rest.

## Two ways to play

- **Demo at the GitHub Pages URL** — hot-seat, single-tab, no save, no login. Pick a seat
  from the tab strip and play all four roles from one browser; the bgio debug panel is
  also mounted (production build hides it). Round-loop reachable end-to-end after 14.1 +
  14.2 + 14.12.
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
npm run server:dev  # bgio Koa server on :8000
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
│   │   ├── resources/         # bag / bank / centerMat / moves / types
│   │   ├── events/            # event deck, dispatcher, eventResolve
│   │   ├── opponent/          # wander deck
│   │   ├── tech/              # tech-card effects
│   │   ├── ai/                # enumerate + per-role bot heuristics
│   │   └── roles/{chief,science,domestic,foreign}/  # per-role moves
│   ├── data/                  # JSON + typed loaders (BUILDINGS / UNITS / TECHNOLOGIES / EVENT_CARDS / WANDER_CARDS / ADJACENCY_RULES / SCIENCE_CARDS / battle / trade decks)
│   ├── ui/                    # MUI panels + cards + chat + chrome
│   │   ├── layout/            # BoardShell, RoleSlot, StatusBar
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
├── plans/                     # execution playbook + 88 sub-plans
│   ├── EXECUTION.md STATUS.md README.md
│   ├── 01.* ... 13.* (done)
│   └── 14.* (post-V1 playtest follow-ups)
├── scripts/                   # dev-seed.ts, build-networked.mjs
├── .github/workflows/         # ci.yml, deploy-pages.yml, deploy-server.yml
├── render.yaml                # Render blueprint (free-tier docker + persistent disk)
├── vite.config.ts             # Vite + Vitest config (port 5179 strict)
├── playwright.config.ts
└── eslint.config.js           # bans Math.random in src/
```

## Plans

Every change in `src/` was driven by a sub-plan under [`plans/`](plans/). The execution
playbook lives in [`plans/EXECUTION.md`](plans/EXECUTION.md); the live status of every
sub-plan is in [`plans/STATUS.md`](plans/STATUS.md).

The 2026-04-29 hot-seat playtest log is packed into
[`plans/14-playtest-followups.md`](plans/14-playtest-followups.md); the 11 stage-14
sub-plans address each finding in priority order, with 14.1 + 14.2 as the unblockers.

## Deploying

- **Hot-seat (GH Pages):** push to `main` → `.github/workflows/deploy-pages.yml` builds
  the hot-seat bundle and deploys. Settings → Pages → Source: GitHub Actions, the first
  time.
- **Networked (Render):** `render.yaml` describes a docker web service with a 1 GB
  persistent disk for the SQLite DB. `.github/workflows/deploy-server.yml` validates the
  server build on each push; Render auto-deploys from the repo. Free-tier sleeps after
  ~15 min idle (~30s wake); the lobby reconnect spinner covers it.

The Vite config uses `base: './'`, so the built site works regardless of the repo name.
