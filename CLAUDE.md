# CLAUDE.md

Project-specific guidance for Claude Code working in this repo.

## What this project is

A **boardgame.io + React + TypeScript + Vite** implementation of a four-role co-op-ish
strategy game, codenamed **Settlement**. It ships two builds out of the same `src/`:

- a **networked** build (the primary delivery) that talks to a bgio Koa `Server` under
  `server/`, and
- a **hot-seat** build (a fallback for local play / quick QA) that wires `Client` with the
  `Local` transport.

The repo is a single Vite app with a sibling `server/` directory — no monorepo, no extra
package boundaries. The hot-seat build deploys to GitHub Pages via
`.github/workflows/deploy-pages.yml`.

## Project stance

These are load-bearing assumptions. If a sub-plan or PR contradicts one, flag it before
implementing.

- **Network play is the primary delivery.** The bgio `Server` under `server/` is the
  source of truth; the hot-seat build is a fallback, not the design target. UI / state
  decisions should assume per-player views and per-player credentials.
- **Default game is 4 players, 1 human + 3 bots.** Bots run server-side via
  `Server({ bots })` driven by each role's `ai.enumerate(G, ctx, playerID)`. Don't design
  flows that only make sense with 4 humans.
- **No fail mode — only a win condition.** `endIf` / `onEnd` in
  `src/game/endConditions.ts` only encode wins. Don't introduce loss states; pressure
  systems should degrade outcomes, not end the match.
- **"Settlement" is a codename.** A real name is deferred until the user picks one. Until
  then, `Settlement` is the symbol exported from `src/game/`, but don't sprinkle the name
  through unrelated copy — a future rename pass will be easier with fewer references.

## Layout you should know

The game logic lives under `src/game/`, the React UI lives under `src/ui/`, JSON content
plus typed loaders live under `src/data/`, and the bgio Koa server lives under `server/`.
Tests under `tests/` mirror the `src/` shape, with shared factories in `tests/helpers/`.

- `src/game/` — barrel; `src/game/index.ts` exports the `Settlement` game object plus the
  public types. This is the only entry point UI / tests / server should import the game
  from. It must stay free of React imports so the same logic runs headless via
  `boardgame.io/client`.
- `src/game/types.ts` — `SettlementState`, role / phase / stage enums, move payload types.
- `src/game/setup.ts`, `src/game/moves.ts` — `setup(ctx, setupData)` and the move
  implementations referenced from phases / stages.
- `src/game/random.ts` — `RandomAPI` wrapper around bgio's `PluginRandom` so call sites
  read as `random.shuffle(...)` / `random.d6()` etc. without reaching for `ctx.random`
  directly.
- `src/game/playerView.ts` — per-role redaction layered over `PlayerView.STRIP_SECRETS`.
- `src/game/hooks.ts` — `registerRoundEndHook` / `runRoundEndHooks`; the queue role
  modules push end-of-round callbacks into instead of cross-importing each other.
- `src/game/endConditions.ts` — `endIf` / `onEnd` for the win condition. There is no
  fail mode (see "Project stance"), so this file only encodes wins.
- `src/game/roles.ts` — `assignRoles`, `seatOfRole`, `rolesAtSeat`. The single source of
  truth for the seat <-> role mapping.
- `src/game/phases/{chief,others,endOfRound,stages,index}.ts` — the bgio `phases` config.
  `chief` is the chief's solo turn, `others` runs the non-chief role stages in parallel
  via `turn.activePlayers`, `endOfRound` runs hooks + advances the round, `stages.ts`
  centralizes stage names.
- `src/game/roles/{chief,science,domestic,foreign}/` — each role owns its move
  implementations and any role-local helpers. Cross-role coordination goes through
  `hooks.ts`, not direct imports.
- `src/game/resources/{types,bag,bank,centerMat}.ts` — resource bag, central bank, and
  center-mat data structures plus their pure helpers.
- `src/game/events/`, `src/game/opponent/`, `src/game/ai/`, `src/game/plugins/` — event
  cards, opponent / threat tracker, bgio `ai.enumerate` definitions, and any custom
  bgio `Plugin`s the game needs.
- `src/data/` — JSON content (`buildings.json`, `units.json`, `technologies.json`) plus
  the typed loaders in `src/data/schema.ts` and `src/data/index.ts`. Imports always go
  through the loaders (`BUILDINGS`, `UNITS`, `TECHNOLOGIES`, `BENEFIT_TOKENS`) — never
  the raw JSON.
- `src/ui/{layout,cards,resources,mat,deck,hand,chief,science,domestic,foreign,chat}/` —
  React components, MUI primitives only. Per-role panels live under
  `src/ui/<role>/`; shared chrome (board layout, card primitives, resource chips,
  center mat, decks, hand) sits alongside.
- `src/App.tsx` — wires `Settlement` + the active board into a `Client({ ... })`
  instance. The only place `boardgame.io/react` is imported.
- `src/main.tsx` — React root; mounts `<App />` into `#root` and wraps it in MUI's
  `ThemeProvider` + `CssBaseline`.
- `src/theme.ts` — single source of truth for visual tokens (ramps, semantic colors,
  per-role accents, MUI palette module augmentation, the `theme` export consumed by
  `ThemeProvider`).
- `server/` — bgio Koa `Server` plus storage adapters (`FlatFile` by default; pluggable
  for `bgio-postgres` / `bgio-sqlite`). The networked build talks to this; the hot-seat
  build does not.
- `tests/` — mirrors `src/`; headless tests use `Client` from `boardgame.io/client`
  (NOT the React one). Shared factories live in `tests/helpers/{makeClient,runMoves,seed}.ts`
  — prefer those over rolling a new client per test.
- `vite.config.ts` — also holds the Vitest config (jsdom, globals on). There is no
  separate `vitest.config.ts`.

## Working conventions

- TypeScript is strict and uses `verbatimModuleSyntax`. Use `import type { ... }` for type-only
  imports, and keep relative imports' `.ts` / `.tsx` extensions (required by `bundler` resolution
  + `allowImportingTsExtensions`).
- The Vite `base` is `'./'` so the build is portable across GitHub Pages URLs. Don't hard-code a
  repo name into the base.
- Game state is mutated directly inside moves — boardgame.io wraps moves in Immer, so direct
  mutation is the idiomatic style. Don't return a new state object.
- Use `INVALID_MOVE` from `boardgame.io/core` to reject illegal moves rather than throwing.
- Network play is the primary delivery (see "Project stance"). The hot-seat build wires
  `Client` without a `playerID` so whichever player's turn it is can move from the same
  browser; the networked build wires the SocketIO transport against `server/`.
- ESLint bans `Math.random` inside `src/`. All randomness goes through `src/game/random.ts`
  (which wraps bgio's `PluginRandom`) so games are deterministic and replayable.

## Use boardgame.io when reasonable

This project's premise is that **boardgame.io is the engine, not a starting point we
outgrow**. Before writing infrastructure code, check whether bgio already ships it and
prefer the built-in. We accept extra glue and small ergonomic cost in exchange for not
maintaining a parallel system.

Reach for the bgio export first for:

- **Engine plumbing.** `phases`, `turn.order` / `turn.stages` / `turn.activePlayers`,
  `events.endTurn` / `endPhase` / `setActivePlayers` / `endStage`, `playerView`,
  `setup(ctx, setupData)`, `endIf`, `onEnd`. Don't hand-roll a state machine over moves
  when phases/stages express it.
- **Randomness.** The `random` plugin (`ctx.random.Shuffle`, `D6`, `Number`). `Math.random`
  is banned in `src/`.
- **Secret state.** `playerView` (with `PlayerView.STRIP_SECRETS` as a starting point) —
  not a custom redactor.
- **Client.** `Client` from `boardgame.io/react` for UI, `Client` from `boardgame.io/client`
  for headless tests / replay drivers.
- **Transports.** `Local` for hot-seat, `SocketIO` from `boardgame.io/multiplayer` for
  networked. Don't write a custom transport.
- **Server.** `Server` from `boardgame.io/server` (Koa). It already exposes the lobby REST
  endpoints (`/games/:name/create`, `:matchID/join`, `:matchID/leave`,
  `:matchID/playAgain`, etc.) — don't add parallel handlers.
- **Lobby.** `Lobby` component from `boardgame.io/react` for the matchmaking UI;
  `LobbyClient` from `boardgame.io/client` for headless REST calls. Customize via
  `Lobby`'s `renderer` prop rather than rebuilding the flow.
- **Storage.** Adapters that implement bgio's `Async` interface (`FlatFile` is built-in;
  `bgio-postgres`, `bgio-sqlite`, etc. are community drop-ins). Don't define a parallel
  `Storage` type — `Async` *is* the contract, and `new Server({ db })` accepts it directly.
- **Chat.** `client.chatMessages` and `client.sendChatMessage(payload)` are built into
  bgio 0.50.x. The Server transports and persists them. No custom plugin or move.
- **Spectators.** `playerID === null` is automatically a spectator on both client and
  server; `playerView` redacts for them. No special spectator infrastructure.
- **Reconnect.** SocketIO transport already reconnects; we only persist credentials in
  `localStorage`. Don't write a custom reconnect loop.
- **Auth.** `authenticateCredentials` hook on `Server` is the integration point for
  account systems. The `playerCredentials` returned by `joinMatch` is the token bgio
  validates on every move.
- **AI / bots.** `RandomBot` and `MCTSBot` from `boardgame.io/ai`; bots are configured
  via the game's `ai.enumerate(G, ctx, playerID)` and via `Server({ bots })` /
  `match.metadata.bots` so the server drives them. No client-side bot loops.
- **Move log / replay.** `state.deltalog` and `client.log` are bgio's authoritative move
  log; replay drives a headless `Client` through them. Don't invent a parallel event log.
- **Debug panel.** bgio's `Client` accepts `debug={true}` — that's the panel. Don't build
  a custom one unless a real gap appears.
- **Plugins.** When a feature genuinely needs to live in match state (e.g., per-player
  private hands beyond what `playerView` covers), write a bgio `Plugin` rather than a
  parallel store. `PluginPlayer`, `PluginRandom`, `PluginEvents`, `PluginImmer` are the
  canonical examples to imitate.

When bgio's built-in falls short of a real requirement, layer a thin shell *over* the
built-in (custom `renderer` prop, custom `Plugin`, wrapper component) — don't replace
it. If a sub-plan or PR proposes hand-rolling something on this list, it should explain
the specific reason bgio's version doesn't fit.

## UI + styling rules

All UI is built with **MUI** (`@mui/material`, with `@emotion/react` + `@emotion/styled` as
peer deps). Do not introduce a parallel styling system.

- Render with MUI primitives — `Box`, `Stack`, `Paper`, `Typography`, `ButtonBase`, `Button`,
  etc. Do NOT add a global CSS file, CSS modules, Tailwind, or styled-components. Anything
  layout / typographic / interactive that needs styling goes through MUI's `sx` prop or
  `styled()`. There is no `src/styles.css`.
- All app-wide visual tokens live in `src/theme.ts`. That file owns the raw `ramps` (palette
  grouped by hue, step numbers = perceived luminance), the semantic `colors` object (`card`,
  `status`, `surface`, …), the MUI palette module augmentation (`declare module
  '@mui/material/styles'`), and the `theme` export consumed by `ThemeProvider`. New colors
  must be added as a ramp slot first, then referenced from a semantic token — **never a raw
  hex literal in component code**. The 09.4 token pass made this a hard rule; the lint /
  review bar is "no `#` hex outside `theme.ts`".
- Read tokens through the theme: `sx={{ color: t => t.palette.card.takenText }}`. This stays
  type-safe via the module augmentation in `theme.ts`. Don't reach into `colors` or `ramps`
  directly from components when the value is already exposed on the palette.
- **Per-role accents come from `palette.role.<role>`** (`palette.role.chief`,
  `palette.role.science`, `palette.role.domestic`, `palette.role.foreign`). Role panels
  under `src/ui/<role>/` should pull their primary accent from there rather than picking
  a ramp slot inline, so the palette stays the one place a designer changes a role's color.
- MUI's defaults handle spacing (`sx={{ p: 1.5 }}`), typography variants
  (`<Typography variant="h4">`), and breakpoints — use them. Don't redefine spacing scales
  or font sizes per component.

## Common commands

```bash
npm run dev               # Vite dev server (HMR) — hot-seat client
npm run server:dev        # bgio Koa server (server/) for the networked build
npm run build             # tsc -b && vite build → dist/ (default = hot-seat)
npm run build:hotseat     # explicit hot-seat build (Local transport)
npm run build:networked   # networked build (SocketIO transport, talks to server/)
npm run preview           # serve dist/ locally
npm test                  # vitest run
npm run test:coverage     # vitest run --coverage
npm run e2e:smoke         # Playwright smoke run (4-player, 1 human + 3 bots)
npm run typecheck         # tsc -b --noEmit
npm run lint
```

## When changing the game

Game changes are role-scoped. The workflow is:

1. **Pick the role's folder** under `src/game/roles/<role>/` (chief / science / domestic /
   foreign). If the change is genuinely cross-role, it belongs in `src/game/hooks.ts` (for
   end-of-round coordination), `src/game/phases/`, or `src/game/endConditions.ts` — not in
   another role's folder.
2. **Update types + moves.** Extend `SettlementState` (or a role-local slice of it) in
   `src/game/types.ts`, then add / change the move implementations in the role folder.
   Wire any new moves into the appropriate stage in `src/game/phases/`. If the move needs
   randomness, take a `RandomAPI` from `src/game/random.ts` rather than touching
   `ctx.random` directly.
3. **Update tests** under `tests/` — they mirror `src/`, so a chief-stage move change goes
   in `tests/game/roles/chief/`. Use the helpers in `tests/helpers/{makeClient,runMoves,seed}.ts`
   instead of building a fresh client by hand. Headless client tests are cheaper than UI
   tests; reach for them first.
4. **Update the matching panel** under `src/ui/<role>/` so the role's UI surfaces the new
   state and dispatches the new moves. Shared chrome (cards, resource chips, center mat)
   lives outside the role folders — touch those only when the change is genuinely shared.
5. If you add a card / unit / building / tech, edit the JSON under `src/data/` and let the
   loader in `src/data/index.ts` re-export it. Don't import the JSON directly from game or
   UI code — go through the typed loader.

A future rename pass will move the codename "Settlement" to a real name; until then, leave
the symbol alone and don't propagate the codename into copy.

## Deployment

`.github/workflows/deploy-pages.yml` is a single-job-then-deploy workflow that runs on push to
`main` and on manual dispatch. The repo's GitHub Pages source must be set to "GitHub Actions" in
repo settings the first time.
