# bgio

A minimal **[boardgame.io](https://boardgame.io/)** + **React** + **TypeScript** + **Vite** starter,
ready to deploy to GitHub Pages.

It ships with **Card Sweep**, a tiny two-player hot-seat card game so you can see all the moving
parts wired up end-to-end: game logic, board component, client, tests, and CI.

## Card Sweep

Nine face-up cards (values 1–9) sit on the table. Players alternate picking one card per turn; the
card's value is added to that player's score. When every card has been taken, the higher score
wins.

The whole game is two files:

- [`src/game.ts`](src/game.ts) — pure game definition (`setup`, `moves`, `endIf`).
- [`src/Board.tsx`](src/Board.tsx) — a React component that renders state and dispatches moves.

`src/App.tsx` glues them together with `Client({ game, board })` from `boardgame.io/react`.

## Getting started

```bash
npm install
npm run dev      # Vite dev server with HMR
npm run build    # type-check + production build into dist/
npm run preview  # serve the built bundle locally
npm test         # vitest
npm run lint
```

Requires Node 20+.

## Deploying to GitHub Pages

A workflow at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and
publishes `dist/` to GitHub Pages on every push to `main`.

To enable it on a fresh repo:

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually) — the workflow installs, tests, builds, and
   deploys.

The Vite config uses `base: './'`, so the built site works regardless of the repo name or whether
it's served from a project page (`username.github.io/repo`) or a custom domain.

## Project layout

```
.
├── index.html              # Vite entry — loads src/main.tsx
├── src/
│   ├── main.tsx            # React root
│   ├── App.tsx             # boardgame.io React Client
│   ├── Board.tsx           # Board component (BoardProps<CardSweepState>)
│   ├── game.ts             # Game<CardSweepState> definition
│   └── styles.css
├── tests/
│   └── game.test.ts        # headless game-logic tests via boardgame.io/client
├── .github/workflows/
│   └── deploy-pages.yml
├── vite.config.ts          # Vite + Vitest config
├── tsconfig.json           # project references → app + node configs
├── tsconfig.app.json
├── tsconfig.node.json
└── eslint.config.js
```

## Replacing Card Sweep with your own game

1. Edit `src/game.ts` — change `CardSweepState`, `setup`, `moves`, and `endIf`.
2. Edit `src/Board.tsx` — render whatever your state needs and call `moves.<yourMove>(...)`.
3. Update `tests/game.test.ts` to cover your moves.

For multiplayer over the network, swap `boardgame.io/react`'s `Client` for `Lobby` /
`SocketIO` — see the [boardgame.io docs](https://boardgame.io/documentation/).
