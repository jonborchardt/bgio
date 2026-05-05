# Settlement (codename)

A four-role co-op-ish strategy game built on **[boardgame.io](https://boardgame.io/)** +
**React** + **TypeScript** + **Vite**, with a sibling **Koa** server under `server/` for
networked play.

> **Status: V1 engine + UI complete; defense redesign fully landed; hot-seat single-tab
> end-to-end playable.** Typecheck + lint clean, Playwright smoke green. The hot-seat
> board ships a seat picker (the local viewer drives any seat), per-role "End my turn"
> buttons, an `activePlayers`-driven "It's your turn — Round N" header, a game-over
> banner, and a unified **central board** that frames the global event track strip on
> top of the village (domestic) grid; per-seat resources live on a player mat
> (`in` / `out` / `stash`) with the chief sweeping `out` into the bank each chief turn,
> dropping resources into seats' `in`, and `in` emptying into `stash` automatically
> when a seat begins its turn. Domestic produce auto-fires at othersPhase entry. The
> defense role replaces the retired Foreign loop: the chief flips one track card per
> round, threats walk a path into the village and are intercepted by units the Defense
> seat recruited onto building tiles, and the village wins by surviving the terminal
> **boss** card (its two thresholds — Science completions and the running-max bank
> gold — each cancel one boss attack). The networked stack assembles end-to-end
> (lobby + accounts + chat + idle bot takeover) but the live two-tab playtest hasn't
> been driven through yet.

## Two ways to play

- **Demo at the GitHub Pages URL** — hot-seat, single-tab, no save, no login. Click a
  seat tile on the center mat and play all four roles from one browser; the bgio debug
  panel is also mounted in dev (production build hides it). Round-loop reachable
  end-to-end.
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
│   │   ├── events/            # per-color event decks, dispatcher, eventResolve
│   │   ├── track.ts track/    # Global Event Track runtime + path / resolver / boss / centerBurn
│   │   ├── tech/              # tech-card effects
│   │   ├── requests/          # cross-seat help-request rows
│   │   ├── ai/                # enumerate + per-role bot heuristics
│   │   └── roles/{chief,science,domestic,defense}/  # per-role moves
│   ├── cards/                 # card registry + cross-card relationship index
│   ├── data/                  # JSON + typed loaders (BUILDINGS / UNITS / TECHNOLOGIES / SCIENCE_CARDS / EVENT_CARDS / TRACK_CARDS / ADJACENCY_RULES)
│   ├── ui/                    # MUI panels + cards + chrome
│   │   ├── layout/            # RolePanel, GameOverBanner, PhaseHint, DevSidebar, …
│   │   ├── chief/ science/ domestic/ defense/   # per-role panels
│   │   ├── centralBoard/      # CentralBoard frame + ProgressBoxes (boss-threshold widgets)
│   │   ├── track/             # TrackStrip, PathOverlay, BossReadout, ResolveStepBanner
│   │   ├── center/            # CenterBurnBanner (vault-burn beat)
│   │   ├── log/ requests/ relationships/ cardPreview/ matPreview/
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

## Deploying

- **Hot-seat (GH Pages):** push to `main` → `.github/workflows/deploy-pages.yml` builds
  the hot-seat bundle and deploys. Settings → Pages → Source: GitHub Actions, the first
  time.
- **Networked (Render):** `render.yaml` describes a docker web service with a 1 GB
  persistent disk for the SQLite DB. `.github/workflows/deploy-server.yml` validates the
  server build on each push; Render auto-deploys from the repo. Free-tier sleeps after
  ~15 min idle (~30s wake); the lobby reconnect spinner covers it.

The Vite config uses `base: './'`, so the built site works regardless of the repo name.
