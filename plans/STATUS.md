# Execution status

The single source of truth for "what's the state of every sub-plan?".
Read [EXECUTION.md](EXECUTION.md) before editing this file.

## Format

One row per sub-plan. Columns:

| Column | Meaning |
|---|---|
| `Sub-plan` | NN.M id, links to the file. |
| `Status` | `pending`, `in_progress`, `done`, `blocked`. |
| `Owner` | Agent name or "human" who currently holds the claim. Empty when pending. |
| `Branch` | `plan/NN.M-<slug>` once claimed. Empty when pending. |
| `Updated` | ISO date of the last status change. |
| `Blocked on` | Comma-separated NN.M ids that must be `done` before this can start. Comes from the sub-plan's "Depends on" line; double-check there. |
| `Notes` | Resume hints, file-overlap flags, deviations. |

## Update discipline

- Always commit STATUS.md changes in their own commit
  (`chore(status): ...`), separate from implementation commits.
- Bump `Updated` on every status flip.
- Never reset another agent's `in_progress` row to `pending` — escalate to
  human if a row looks stale (>24h with no pushed activity).

---

## 01 — Foundations

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [01.1](01.1-state-shape.md) | done | claude | plan/01.1 | 2026-04-27 |  | Done. `src/game/{types,roles,index}.ts` + `tests/roles.test.ts`. |
| [01.2](01.2-data-loaders.md) | done | claude | plan/01.2 | 2026-04-27 |  | Done. `src/data/{schema,index}.ts` + `tests/data.test.ts`. |
| [01.3](01.3-game-skeleton.md) | pending |  |  |  | 01.1, 01.2 | Touches `src/App.tsx`, `src/Board.tsx`, `index.html`. |
| [01.4](01.4-test-harness.md) | pending |  |  |  | 01.3 | Touches `tests/helpers/`. |
| [01.5](01.5-claude-md-refresh.md) | pending |  |  |  | 01.1, 01.2, 01.3, 01.4 | Touches `CLAUDE.md`. |

## 02 — Engine

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [02.1](02.1-phase-skeleton.md) | pending |  |  |  | 01.1, 01.3 | Touches `src/game/phases/`. |
| [02.2](02.2-stages-and-active-players.md) | pending |  |  |  | 02.1 |  |
| [02.3](02.3-randomness.md) | pending |  |  |  | 02.1 | Touches `eslint.config.js`. |
| [02.4](02.4-secret-state.md) | pending |  |  |  | 01.1 |  |
| [02.5](02.5-end-of-round.md) | pending |  |  |  | 02.1 |  |

## 03 — Resources

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [03.1](03.1-token-types.md) | done | claude | plan/03.1 | 2026-04-27 |  | Done. `src/game/resources/{types,bag}.ts` + tests. |
| [03.2](03.2-bank.md) | pending |  |  |  | 03.1 |  |
| [03.3](03.3-center-mat.md) | pending |  |  |  | 03.1, 03.2, 02.5, 01.1 |  |
| [03.4](03.4-moves.md) | pending |  |  |  | 01.1, 01.3, 02.1, 03.1, 03.2, 03.3 |  |

## 04 — Chief

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [04.1](04.1-distribute-move.md) | pending |  |  |  | 01.1, 02.1, 03.1, 03.2, 03.3 |  |
| [04.2](04.2-end-phase.md) | pending |  |  |  | 02.1, 02.2 |  |
| [04.3](04.3-worker-placement-stub.md) | pending |  |  |  | 01.1, 02.1, 04.2 | Soft dep on 06.1; works without it. |
| [04.4](04.4-gold-event-stub.md) | pending |  |  |  | 01.1, 02.1, 02.2 | Soft dep on 08; short-circuits until then. |
| [04.5](04.5-panel.md) | pending |  |  |  | 04.1, 04.2 | Touches `src/Board.tsx`. Soft dep on 09.4. |

## 05 — Science

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [05.1](05.1-grid-setup.md) | pending |  |  |  | 01.2, 02.3, 02.5, 03 |  |
| [05.2](05.2-contribute-move.md) | pending |  |  |  | 01.1, 02.1, 02.2, 03.4, 05.1 |  |
| [05.3](05.3-complete-move.md) | pending |  |  |  | 01.1, 02.5, 03.2, 05.1, 05.2 |  |
| [05.4](05.4-event-stub.md) | pending |  |  |  | 01.1, 02.1, 02.2 | Soft dep on 08. |
| [05.5](05.5-panel.md) | pending |  |  |  | 05.1, 05.2, 05.3 | Touches `src/Board.tsx`. Soft dep on 09.2. |

## 06 — Domestic

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [06.1](06.1-hand-and-grid.md) | pending |  |  |  | 01.2, 02.5, 05.1 |  |
| [06.2](06.2-buy-and-upgrade.md) | pending |  |  |  | 01.2, 03.4, 06.1 |  |
| [06.3](06.3-benefit-parser.md) | pending |  |  |  | 01.2, 03.1 |  |
| [06.4](06.4-produce-move.md) | pending |  |  |  | 01.2, 03.2, 06.1, 06.3, 02.5 |  |
| [06.5](06.5-adjacency-rules.md) | pending |  |  |  | 03.1, 06.1, 06.4 |  |
| [06.6](06.6-event-stub.md) | pending |  |  |  | 01.1, 02.1, 02.2 | Soft dep on 08. |
| [06.7](06.7-panel.md) | pending |  |  |  | 06.1, 06.2, 06.4 | Touches `src/Board.tsx`. Soft deps on 09.2, 09.4. |
| [06.8](06.8-adjacency-content.md) | pending |  |  |  | 01.2, 06.5 | AI-assisted authoring. |

## 07 — Foreign

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [07.1](07.1-decks.md) | pending |  |  |  | 01.2, 02.3, 02.4 |  |
| [07.2](07.2-units.md) | pending |  |  |  | 01.2, 03.4 | Soft dep on 06.3, 06.4. |
| [07.3](07.3-battle-resolver.md) | pending |  |  |  | 01.2, 07.2 | Heavy — flagged for possible split. |
| [07.4](07.4-flip-flow.md) | pending |  |  |  | 02.2, 03.3, 07.1, 07.2, 07.3 |  |
| [07.5](07.5-trade-request.md) | pending |  |  |  | 02.2, 03.3, 07.4 |  |
| [07.6](07.6-event-stub.md) | pending |  |  |  | 01.1, 02.1, 02.2 | Soft dep on 08. |
| [07.7](07.7-panel.md) | pending |  |  |  | 07.1, 07.2, 07.3, 07.4 | Touches `src/Board.tsx`. Soft deps on 09.2, 09.5. |

## 08 — Cross-cutting

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [08.1](08.1-event-deck-shape.md) | pending |  |  |  | 01.1, 01.2, 02.5 |  |
| [08.2](08.2-event-dispatcher.md) | pending |  |  |  | 01, 02, 08.1 | Heavy — flagged for possible split (per effect kind). |
| [08.3](08.3-event-moves.md) | pending |  |  |  | 04.4, 05.4, 06.6, 07.6, 08.1, 08.2 |  |
| [08.4](08.4-wander-deck.md) | pending |  |  |  | 01.2, 02.4, 02.5, 08.2 |  |
| [08.5](08.5-end-conditions.md) | pending |  |  |  | 01.1, 02.1, 07 |  |
| [08.6](08.6-tech-card-content.md) | pending |  |  |  | 01.2, 05.3, 08.2 | AI-assisted authoring. Per-role PlayTech moves. |

## 09 — UI

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [09.1](09.1-layout-shell.md) | pending |  |  |  | 01, 02 | Touches `src/Board.tsx`. |
| [09.2](09.2-card-components.md) | pending |  |  |  | 01.2 | Soft dep on 09.3, 09.4. |
| [09.3](09.3-resource-and-mat.md) | pending |  |  |  | 03 | Soft dep on 09.4. |
| [09.4](09.4-theme-tokens.md) | pending |  |  |  | 01.1, 03.1, 08.1 | Touches `src/theme.ts`. |
| [09.5](09.5-deck-and-hand.md) | pending |  |  |  | 09.2 |  |

## 10 — Multiplayer infra

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [10.1](10.1-server-package.md) | pending |  |  |  | 01.3 | Touches `server/`, `package.json`, `tsconfig.app.json`. |
| [10.2](10.2-transport-and-client-modes.md) | pending |  |  |  | 01.3, 10.1 | Touches `src/App.tsx`, `vite.config.ts`. |
| [10.3](10.3-lobby.md) | pending |  |  |  | 10.1, 10.2 | Heavy — flagged for possible split. Soft dep on 09.4. |
| [10.4](10.4-storage.md) | pending |  |  |  | 10.1 | Heavy — flagged for possible split. |
| [10.5](10.5-chat.md) | pending |  |  |  | 10.1, 10.2 | Touches `src/Board.tsx`. |
| [10.6](10.6-reconnect-and-credentials.md) | pending |  |  |  | 10.2, 10.3 | Touches `src/App.tsx`, `src/lobby/`. |
| [10.7](10.7-accounts.md) | pending |  |  |  | 10.1, 10.3, 10.4, 13.3, 08.5 |  |
| [10.8](10.8-spectators.md) | pending |  |  |  | 02.4, 10.1, 10.3, 10.5, 10.7 | Touches `src/Board.tsx`. |
| [10.9](10.9-idle-bot-takeover.md) | pending |  |  |  | 10.1, 10.7, 11.3, 11.4, 11.5, 11.6 |  |

## 11 — AI / bots

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [11.1](11.1-random-fuzzer.md) | pending |  |  |  | 01-08 | More landed = better coverage. |
| [11.2](11.2-mcts-baseline.md) | pending |  |  |  | 01-08 |  |
| [11.3](11.3-chief-bot.md) | pending |  |  |  | 04, 11.2 |  |
| [11.4](11.4-science-bot.md) | pending |  |  |  | 05, 11.2 |  |
| [11.5](11.5-domestic-bot.md) | pending |  |  |  | 06, 11.2 |  |
| [11.6](11.6-foreign-bot.md) | pending |  |  |  | 07, 11.2 |  |
| [11.7](11.7-solo-mode.md) | pending |  |  |  | 10.3, 10.6, 11.3, 11.4, 11.5, 11.6 | Touches `src/lobby/`, `src/App.tsx`. |

## 12 — Testing & debugging

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [12.1](12.1-test-helpers.md) | pending |  |  |  | 01.4, 11.1 |  |
| [12.2](12.2-debug-panel.md) | pending |  |  |  | 01.3, 09.1 | Touches `src/App.tsx`. |
| [12.3](12.3-replay.md) | pending |  |  |  | 01-08, 10.1, 13.3 | Touches `src/App.tsx`. |
| [12.4](12.4-ci-workflow.md) | pending |  |  |  | 01-11 | Touches `.github/workflows/`. |
| [12.5](12.5-playwright-setup.md) | pending |  |  |  | 09.1 | Add `data-testid` to BoardShell. |
| [12.6](12.6-coverage-gate.md) | pending |  |  |  | 01-11 | Touches `vite.config.ts`, `package.json`. |
| [12.7](12.7-dev-full-stack.md) | pending |  |  |  | 10.1, 10.2, 10.4, 10.7, 11.7 | Touches `package.json`, `.env.example`, `.gitignore`. |

## 13 — Deployment & persistence

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [13.1](13.1-static-build-modes.md) | pending |  |  |  | 10.2 | Touches `vite.config.ts`, `package.json`, `.github/workflows/deploy-pages.yml`. |
| [13.2](13.2-server-deploy-target.md) | pending |  |  |  | 10.1, 10.4, 12.4 | Render. Touches `server/Dockerfile`, `.github/workflows/deploy-server.yml`. |
| [13.3](13.3-database-choice.md) | pending |  |  |  | 10.4, 13.2 | SQLite via `better-sqlite3`. Heavy — flagged for possible split. |
| [13.4](13.4-pages-deploy-keep-alive.md) | pending |  |  |  | 10.2, 12.4, 12.5, 13.1 | Touches `.github/workflows/deploy-pages.yml`. |
