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
