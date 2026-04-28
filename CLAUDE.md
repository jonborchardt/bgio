# CLAUDE.md

Project-specific guidance for Claude Code working in this repo.

## What this project is

A minimal **boardgame.io + React + TypeScript + Vite** starter that ships a working two-player
hot-seat card game (Card Sweep) and deploys to GitHub Pages via the workflow at
`.github/workflows/deploy-pages.yml`.

The whole thing is intentionally small: a single Vite app at the repo root, no monorepo, no
backend. boardgame.io runs entirely client-side via its React `Client` factory.

## Layout you should know

- `src/game.ts` — the pure game definition. Anything turn-order, state-shape, or win-condition
  related goes here. It must stay free of React imports so the same logic can run in headless
  tests via `boardgame.io/client`.
- `src/Board.tsx` — the React board component. Receives `BoardProps<CardSweepState>` from
  boardgame.io and dispatches moves via `moves.<name>(...)`.
- `src/App.tsx` — wires `game` + `board` into a `Client({ ... })` instance. This is the only
  place `boardgame.io/react` is imported.
- `src/main.tsx` — React root; mounts `<App />` into `#root` and wraps it in MUI's
  `ThemeProvider` + `CssBaseline`.
- `src/theme.ts` — the single source of truth for visual tokens (ramps, semantic colors,
  MUI palette module augmentation, the `theme` export consumed by `ThemeProvider`).
- `tests/game.test.ts` — headless tests using `Client` from `boardgame.io/client` (NOT the React
  one). When adding game logic, prefer adding tests here over UI tests.
- `vite.config.ts` — also holds the Vitest config (jsdom, globals on). There is no separate
  `vitest.config.ts`.

## Working conventions

- TypeScript is strict and uses `verbatimModuleSyntax`. Use `import type { ... }` for type-only
  imports, and keep relative imports' `.ts` / `.tsx` extensions (required by `bundler` resolution
  + `allowImportingTsExtensions`).
- The Vite `base` is `'./'` so the build is portable across GitHub Pages URLs. Don't hard-code a
  repo name into the base.
- Game state is mutated directly inside moves — boardgame.io wraps moves in Immer, so direct
  mutation is the idiomatic style. Don't return a new state object.
- Use `INVALID_MOVE` from `boardgame.io/core` to reject illegal moves rather than throwing.
- Hot-seat play is the default: `App.tsx` does not pass a `playerID` to `Client`, so whichever
  player's turn it is can move from the same browser. If you add network multiplayer, that's
  where to wire it.

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
  must be added as a ramp slot first, then referenced from a semantic token — never a raw
  hex literal in component code.
- Read tokens through the theme: `sx={{ color: t => t.palette.card.takenText }}`. This stays
  type-safe via the module augmentation in `theme.ts`. Don't reach into `colors` or `ramps`
  directly from components when the value is already exposed on the palette.
- MUI's defaults handle spacing (`sx={{ p: 1.5 }}`), typography variants
  (`<Typography variant="h4">`), and breakpoints — use them. Don't redefine spacing scales
  or font sizes per component.

## Common commands

```bash
npm run dev        # dev server (HMR)
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve dist/ locally
npm test           # vitest run
npm run typecheck  # tsc -b --noEmit
npm run lint
```

## When changing the game

1. Update `CardSweepState` and the move signatures in `src/game.ts`.
2. Update `src/Board.tsx` to render the new state and call the new moves.
3. Update `tests/game.test.ts` — the headless client makes it easy to drive a full game from a
   test.

When the game is no longer Card Sweep, also update the title in `index.html` and the README.

## Deployment

`.github/workflows/deploy-pages.yml` is a single-job-then-deploy workflow that runs on push to
`main` and on manual dispatch. The repo's GitHub Pages source must be set to "GitHub Actions" in
repo settings the first time.
