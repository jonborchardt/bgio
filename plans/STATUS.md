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
| [01.3](01.3-game-skeleton.md) | done | claude | plan/01.3 | 2026-04-27 | 01.1, 01.2 | Done. Settlement game with `pass` move; SettlementBoard stub. |
| [01.4](01.4-test-harness.md) | done | claude | plan/01.4 | 2026-04-27 | 01.3 | Done. tests/helpers/{makeClient,runMoves,seed}.ts. |
| [01.5](01.5-claude-md-refresh.md) | done | claude | plan/01.5 | 2026-04-27 | 01.1, 01.2, 01.3, 01.4 | Done. CLAUDE.md updated for new layout, stance, commands. |

## 02 — Engine

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [02.1](02.1-phase-skeleton.md) | done | claude | plan/02.1 | 2026-04-27 | 01.1, 01.3 | Done. chief/others/endOfRound phases; phaseDone+othersDone flags. |
| [02.2](02.2-stages-and-active-players.md) | done | claude | plan/02.2 | 2026-04-27 | 02.1 | Done. STAGES + activePlayersForOthers + enter/exitEventStage. |
| [02.3](02.3-randomness.md) | done | claude | plan/02.3 | 2026-04-27 | 02.1 | Done. fromBgio adapter; ESLint bans Math.random in src/. |
| [02.4](02.4-secret-state.md) | done | claude | plan/02.4 | 2026-04-27 | 01.1 | Done. playerView redacts Domestic hand + Foreign hand/decks per role. |
| [02.5](02.5-end-of-round.md) | done | claude | plan/02.5 | 2026-04-27 | 02.1 | Done. registerRoundEndHook + runRoundEndHooks; endOfRound consumes registry. |

## 03 — Resources

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [03.1](03.1-token-types.md) | done | claude | plan/03.1 | 2026-04-27 |  | Done. `src/game/resources/{types,bag}.ts` + tests. |
| [03.2](03.2-bank.md) | done | claude | plan/03.2 | 2026-04-27 | 03.1 | Done. transfer/initialBank/totalResources; setup uses initialBank(). |
| [03.3](03.3-center-mat.md) | done | claude | plan/03.3 | 2026-04-27 | 03.1, 03.2, 02.5, 01.1 | Done. CenterMat + per-non-chief circles + mat:sweep-leftovers hook. |
| [03.4](03.4-moves.md) | done | claude | plan/03.4 | 2026-04-27 | 01.1, 01.3, 02.1, 03.1, 03.2, 03.3 | Done. pullFromMat move + payFromWallet helper; G.wallets per non-chief seat. |

## 04 — Chief

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [04.1](04.1-distribute-move.md) | done | claude | plan/04.1 | 2026-04-28 | 01.1, 02.1, 03.1, 03.2, 03.3 | Done. chiefDistribute(target, amounts) bank->circle. |
| [04.2](04.2-end-phase.md) | done | claude | plan/04.2 | 2026-04-28 | 02.1, 02.2 | Done. chiefEndPhase flips phaseDone, bgio transitions to othersPhase. |
| [04.3](04.3-worker-placement-stub.md) | done | claude | plan/04.3 | 2026-04-28 | 01.1, 02.1, 04.2 | Done. chiefPlaceWorker stub gated by G._features.workersEnabled. |
| [04.4](04.4-gold-event-stub.md) | done | claude | plan/04.4 | 2026-04-28 | 01.1, 02.1, 02.2 | Done. chiefPlayGoldEvent stub - bookkeeping; 08.3 wires effects. |
| [04.5](04.5-panel.md) | done | claude | plan/04.5 | 2026-04-28 | 04.1, 04.2 | Done. ChiefPanel + CircleEditor; render tests are it.todo until RTL lands. |

## 05 — Science

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [05.1](05.1-grid-setup.md) | done | claude | plan/05.1 | 2026-04-28 | 01.2, 02.3, 02.5, 03 | Done. 3x3 grid + 4 techs/cell + reset-completions hook. |
| [05.2](05.2-contribute-move.md) | done | claude | plan/05.2 | 2026-04-28 | 01.1, 02.1, 02.2, 03.4, 05.1 | Done. Lowest-first column rule + capped-at-cost transfer. |
| [05.3](05.3-complete-move.md) | done | claude | plan/05.3 | 2026-04-28 | 01.1, 02.5, 03.2, 05.1, 05.2 | Done. distributes 4 tech cards by color to chief/science/domestic/foreign hands. |
| [05.4](05.4-event-stub.md) | done | claude | plan/05.4 | 2026-04-28 | 01.1, 02.1, 02.2 | Done. sciencePlayBlueEvent stub via shared playEventStub helper. |
| [05.5](05.5-panel.md) | done | claude | plan/05.5 | 2026-04-28 | 05.1, 05.2, 05.3 | Done. SciencePanel renders 3x3 grid + per-card contribute/complete. |

## 06 — Domestic

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [06.1](06.1-hand-and-grid.md) | done | claude | plan/06.1 | 2026-04-28 | 01.2, 02.5, 05.1 | Done. DomesticState (hand+techHand+grid), placement legality, setupDomestic. |
| [06.2](06.2-buy-and-upgrade.md) | done | claude | plan/06.2 | 2026-04-28 | 01.2, 03.4, 06.1 | Done. domesticBuyBuilding + domesticUpgradeBuilding (V1 50% delta). |
| [06.3](06.3-benefit-parser.md) | done | claude | plan/06.3 | 2026-04-28 | 01.2, 03.1 | Done. parseBenefit handles all 17 BUILDINGS strings + accepts defence spelling. |
| [06.4](06.4-produce-move.md) | done | claude | plan/06.4 | 2026-04-28 | 01.2, 03.2, 06.1, 06.3, 02.5 | Done. Sums building yields, doubles for workers, idempotent via producedThisRound. |
| [06.5](06.5-adjacency-rules.md) | done | claude | plan/06.5 | 2026-04-28 | 03.1, 06.1, 06.4 | Done. yieldAdjacencyBonus + registry; produce consults it. |
| [06.6](06.6-event-stub.md) | done | claude | plan/06.6 | 2026-04-28 | 01.1, 02.1, 02.2 | Done. domesticPlayGreenEvent stub via shared playEventStub helper. |
| [06.7](06.7-panel.md) | done | claude | plan/06.7 | 2026-04-28 | 06.1, 06.2, 06.4 | Done. DomesticPanel: hand + grid + produce. |
| [06.8](06.8-adjacency-content.md) | done | claude | plan/06.8 | 2026-04-28 | 01.2, 06.5 | Done. 12 hand-authored rules in src/data/adjacency.json. |

## 07 — Foreign

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [07.1](07.1-decks.md) | done | claude | plan/07.1 | 2026-04-28 | 01.2, 02.3, 02.4 | Done. battle+trade decks + redaction wiring. |
| [07.2](07.2-units.md) | done | claude | plan/07.2 | 2026-04-28 | 01.2, 03.4 | Done. recruit/upkeep/release with Forge/Walls modifiers via parseBenefit. |
| [07.3](07.3-battle-resolver.md) | done | claude | plan/07.3 | 2026-04-28 | 01.2, 07.2 | Done. Pure resolver; V1 abilities (focus/splash/armor/heal/singleUse). |
| [07.4](07.4-flip-flow.md) | done | claude | plan/07.4 | 2026-04-28 | 02.2, 03.3, 07.1, 07.2, 07.3 | Done. flipBattle/assignDamage/flipTrade; foreignAwaitingDamage stage. |
| [07.5](07.5-trade-request.md) | done | claude | plan/07.5 | 2026-04-28 | 02.2, 03.3, 07.4 | Done. placeOrInterruptTrade + chiefDecideTradeDiscard via _awaitingChiefTradeDiscard flag. |
| [07.6](07.6-event-stub.md) | done | claude | plan/07.6 | 2026-04-28 | 01.1, 02.1, 02.2 | Done. foreignPlayRedEvent stub via shared playEventStub helper. |
| [07.7](07.7-panel.md) | done | claude | plan/07.7 | 2026-04-28 | 07.1, 07.2, 07.3, 07.4 | Done. ForeignPanel: army + decks + battle + assign-damage stub. |

## 08 — Cross-cutting

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [08.1](08.1-event-deck-shape.md) | done | claude | plan/08.1 | 2026-04-28 | 01.1, 01.2, 02.5 | Done. EventsState + setupEvents + cycleAdvance + reset hook. |
| [08.2](08.2-event-dispatcher.md) | done | claude | plan/08.2 | 2026-04-28 | 01, 02, 08.1 | Done. dispatch + hasModifier/consumeModifier + 9 effect kinds. |
| [08.3](08.3-event-moves.md) | done | claude | plan/08.3 | 2026-04-28 | 04.4, 05.4, 06.6, 07.6, 08.1, 08.2 | Done. play*Event stubs now dispatch + eventResolve for awaitInput. |
| [08.4](08.4-wander-deck.md) | done | claude | plan/08.4 | 2026-04-28 | 01.2, 02.4, 02.5, 08.2 | Done. 24-card opponent deck + opponent:wander-step round-end hook. |
| [08.5](08.5-end-conditions.md) | done | claude | plan/08.5 | 2026-04-28 | 01.1, 02.1, 07 | Done. endIf with win/timeUp; settlementsJoined+turnCap on G. |
| [08.6](08.6-tech-card-content.md) | done | claude | plan/08.6 | 2026-04-28 | 01.2, 05.3, 08.2 | Done. Schema gains optional effect fields; 4 PlayTech moves; applyTechOnAcquire wired into 05.3. |

## 09 — UI

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [09.1](09.1-layout-shell.md) | done | claude | plan/09.1 | 2026-04-28 | 01, 02 | Done. BoardShell + RoleSlot + StatusBar; Board.tsx wired through shell. |
| [09.2](09.2-card-components.md) | done | claude | plan/09.2 | 2026-04-28 | 01.2 | Done. CardFrame + 5 typed cards under src/ui/cards/. |
| [09.3](09.3-resource-and-mat.md) | done | claude | plan/09.3 | 2026-04-28 | 03 | Done. ResourceBag + ResourceChip + CenterMat + Circle + TradeRequestSlot. |
| [09.4](09.4-theme-tokens.md) | done | claude | plan/09.4 | 2026-04-28 | 01.1, 03.1, 08.1 | Done. palette.{resource,role,tier,eventColor} groups via MUI augmentation. |
| [09.5](09.5-deck-and-hand.md) | done | claude | plan/09.5 | 2026-04-28 | 09.2 | Done. Generic DeckStack<T> + Hand<T>. |

## 10 — Multiplayer infra

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [10.1](10.1-server-package.md) | done | claude | plan/10.1 | 2026-04-28 | 01.3 | Done. createServer() at server/index.ts; tsx scripts; Dockerfile placeholder. |
| [10.2](10.2-transport-and-client-modes.md) | done | claude | plan/10.2 | 2026-04-28 | 01.3, 10.1 | Done. detectMode + networkedClientFactory; App selects hot-seat vs networked. |
| [10.3](10.3-lobby.md) | done | claude | plan/10.3 | 2026-04-28 | 10.1, 10.2 | Done. LobbyShell + SeatPicker on LobbyClient REST; minimal MUI lobby UI. |
| [10.4](10.4-storage.md) | done | claude | plan/10.4 | 2026-04-28 | 10.1 | Done. makeStorage('memory'|'flatfile'); SQLite deferred to 13.3. |
| [10.5](10.5-chat.md) | done | claude | plan/10.5 | 2026-04-28 | 10.1, 10.2 | Done. ChatPane + ChatComposer reading bgio's built-in chat. |
| [10.6](10.6-reconnect-and-credentials.md) | done | claude | plan/10.6 | 2026-04-28 | 10.2, 10.3 | Done. localStorage creds (24h TTL); App skips lobby when valid; spinner stub. |
| [10.7](10.7-accounts.md) | done | claude | plan/10.7 | 2026-04-28 | 10.1, 10.3, 10.4, 13.3, 08.5 | Done. In-memory accounts/runs + scrypt hash + AuthForms; SQLite swap deferred. |
| [10.8](10.8-spectators.md) | done | claude | plan/10.8 | 2026-04-28 | 02.4, 10.1, 10.3, 10.5, 10.7 | Done. spectatorClient + Watch button; Board hides actions when playerID===null. |
| [10.9](10.9-idle-bot-takeover.md) | done | claude | plan/10.9 | 2026-04-28 | 10.1, 10.7, 11.3, 11.4, 11.5, 11.6 | Done. Watcher wired; grantBotControl/revokeBotControl stubs until 11.x. |

## 11 — AI / bots

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [11.1](11.1-random-fuzzer.md) | done | claude | plan/11.1 | 2026-04-28 | 01-08 | Done. RandomBot fuzz + invariant assertions. |
| [11.2](11.2-mcts-baseline.md) | done | claude | plan/11.2 | 2026-04-28 | 01-08 | Done. enumerate() wired on Settlement.ai; MCTSBot smoke construct. |
| [11.3](11.3-chief-bot.md) | done | claude | plan/11.3 | 2026-04-28 | 04, 11.2 | Done. Demand-proportional 1-gold-per-call distribution + endPhase. |
| [11.4](11.4-science-bot.md) | done | claude | plan/11.4 | 2026-04-28 | 05, 11.2 | Done. Greedy contribute + complete with per-round cap. |
| [11.5](11.5-domestic-bot.md) | done | claude | plan/11.5 | 2026-04-28 | 06, 11.2 | Done. Buys cheapest at best-adjacency cell + produce. |
| [11.6](11.6-foreign-bot.md) | done | claude | plan/11.6 | 2026-04-28 | 07, 11.2 | Done. Upkeep + recruit + flip-when-resolver-predicts-win. |
| [11.7](11.7-solo-mode.md) | done | claude | plan/11.7 | 2026-04-28 | 10.3, 10.6, 11.3, 11.4, 11.5, 11.6 | Done. buildBotMap + CreateMatchForm with solo toggle; net wiring it.todo. |

## 12 — Testing & debugging

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [12.1](12.1-test-helpers.md) | done | claude | plan/12.1 | 2026-04-28 | 01.4, 11.1 | Done. factories/seeds/assertConservation. |
| [12.2](12.2-debug-panel.md) | done | claude | plan/12.2 | 2026-04-28 | 01.3, 09.1 | Done. Client debug=DEV in dev only. |
| [12.3](12.3-replay.md) | done | claude | plan/12.3 | 2026-04-28 | 01-08, 10.1, 13.3 | Done. MoveLog + recorder + replay stub; LRU localStorage. |
| [12.4](12.4-ci-workflow.md) | done | claude | plan/12.4 | 2026-04-28 | 01-11 | Done. .github/workflows/ci.yml runs typecheck+lint+test+build+e2e. |
| [12.5](12.5-playwright-setup.md) | done | claude | plan/12.5 | 2026-04-28 | 09.1 | Done. playwright.config + smoke spec; BoardShell got data-testid. |
| [12.6](12.6-coverage-gate.md) | done | claude | plan/12.6 | 2026-04-28 | 01-11 | Done. vitest coverage block (70/70/70 V1; ratchet later). |
| [12.7](12.7-dev-full-stack.md) | done | claude | plan/12.7 | 2026-04-28 | 10.1, 10.2, 10.4, 10.7, 11.7 | Done. dev:full + dev-seed + .env additions. Needs `npm install` to run. |

## 13 — Deployment & persistence

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [13.1](13.1-static-build-modes.md) | done | claude | plan/13.1 | 2026-04-28 | 10.2 | Done. build:hotseat + build:networked via scripts/build-networked.mjs. |
| [13.2](13.2-server-deploy-target.md) | done | claude | plan/13.2 | 2026-04-28 | 10.1, 10.4, 12.4 | Done. Render blueprint + deploy-server CI; Dockerfile multi-stage with native deps. |
| [13.3](13.3-database-choice.md) | done | claude | plan/13.3 | 2026-04-28 | 10.4, 13.2 | Done. SqliteStorage Async impl + 2 migrations; native dep load is lazy. |
| [13.4](13.4-pages-deploy-keep-alive.md) | done | claude | plan/13.4 | 2026-04-28 | 10.2, 12.4, 12.5, 13.1 | Done. deploy-pages uses build:hotseat; CI catches Pages-breakers. |

## Stage 01-13 summary

All 77 sub-plans across stages 01-13 are `done`. 449 tests pass,
typecheck and lint clean, coverage 83/75/91 (gate 80/85/70),
Playwright smoke green.

## Post-V1 review fixes (post-stage-13, 2026-04-28)

A multi-agent review of the unpushed branch surfaced 10 correctness
/ security issues. All fixed and committed:

| # | Commit | Fix |
|---|---|---|
| 1 | `df35acb` | Gate `__test*` moves behind `NODE_ENV=test` |
| 2 | `4ce01bd` | playerView redacts every documented private slice |
| 3 | `a62b2a1` | Reject negative / non-integer amounts in resource moves |
| 4 | `4ac3ccb` | Round-end hooks reset `_upkeepPaid` + `_eventPlayedThisRound` |
| 5 | `38caf36` | Gate `?matchID` query-string creds path behind `DEV` |
| 6 | `2831673` | Reconcile `SettlementSetupData`; plumb solo + startingBank |
| 7 | `bd69eb4` | `enumerate` uses correct `DamageAllocation` shape |
| 8 | `bd8cade` | Thread bgio Server through seatTakeover; drop module state |
| 9 | `27bca5f` | sqlite log append uses `MAX(idx)+1` + plain `INSERT` |
| 10 | `ddbd175` | Body cap + per-IP token bucket on `/auth/*` writes |

## 14 — Playtest follow-ups

Driven by [../notes/playtest-2026-04-29.md](../notes/playtest-2026-04-29.md).
Stage 14 closes the gaps that the 2026-04-29 hot-seat playtest
surfaced — the headline being that the default build has no playable
action surface because every role panel returns null when no
`playerID` is set.

| Sub-plan | Status | Owner | Branch | Updated | Blocked on | Notes |
|---|---|---|---|---|---|---|
| [14.1](14.1-hot-seat-seat-picker.md) | pending |  |  |  | 04.5, 05.5, 06.7, 07.7 | Sticky tab strip; calls `client.updatePlayerID`. Unblocker. |
| [14.2](14.2-role-done-buttons.md) | pending |  |  |  | 02.1, 02.2, 04.5, 05.5, 06.7, 07.7 | Real `<role>SeatDone` moves + per-panel buttons. Unblocker. |
| [14.3](14.3-mode-status-cleanup.md) | pending |  |  |  | 09.1, 09.3, 10.2, 04.5, 14.1 | Mode label + CenterMat dedup. |
| [14.4](14.4-circle-editor-multi-resource.md) | pending |  |  |  | 03.1, 04.1, 04.5, 09.4 | Per-non-zero-resource rows in CircleEditor. |
| [14.5](14.5-game-over-banner.md) | pending |  |  |  | 08.5, 09.1 | Reads `ctx.gameover`; sticky win/timeUp banner. |
| [14.6](14.6-phase-hints.md) | pending |  |  |  | 09.1, 14.1 | One-line "what you can do now" hint. |
| [14.7](14.7-hot-seat-hide-chat.md) | pending |  |  |  | 10.2, 10.5 | Hide chat in hot-seat (no transport). |
| [14.8](14.8-favicon.md) | pending |  |  |  |  | Silence the favicon 404. |
| [14.9](14.9-readme-demo-claim.md) | pending |  |  |  | 13.4, 14.1, 14.2 | Update README "Demo" line. |
| [14.10](14.10-foreign-assign-damage-dialog.md) | pending |  |  |  | 07.3, 07.4, 07.7 | Real per-round absorber UI. |
| [14.11](14.11-networked-playtest.md) | pending |  |  |  | 10.x, 12.7, 13.3, 14.1, 14.2 | E2E networked playtest; produces a notes file. |
