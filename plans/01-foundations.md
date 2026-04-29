# 01 — Foundations

> **Status: done** (all sub-plans landed; see
> [STATUS.md](STATUS.md) for the canonical per-row state).

## Goal

Replace the Card Sweep skeleton with a typed Settlement skeleton that compiles,
loads JSON content, and runs an empty round end-to-end in tests.

## Scope

**In:**
- New state types (`SettlementState` with placeholders for resources, players,
  role assignments, decks, mats).
- Player count → role assignment table (1/2/3/4 from game-design.md §Players).
- JSON data loaders for [buildings.json](../src/data/buildings.json),
  [units.json](../src/data/units.json),
  [technologies.json](../src/data/technologies.json), with typed shapes.
- A minimal `Game<SettlementState>` whose only move is a no-op `pass`, so the
  test harness pattern stays alive while real moves get added.
- Replace `CardSweep` references in `App.tsx`, `Board.tsx`, `index.html` title.
- Default `numPlayers: 4` everywhere a default is needed (3 bots fill in
  during dev / solo).
- Update README to say "work in progress, see /plans".
- Refresh [CLAUDE.md](../CLAUDE.md) so future sessions see the new module
  structure.

**Out:**
- Any actual gameplay logic (that is stages 02–08).
- Any UI beyond a stub board that prints state.
- Renaming the project. Codename "Settlement" until the user picks a name.

## Depends on

Nothing — this is the entry point.

## Sub-plans

- [01.1-state-shape.md](01.1-state-shape.md) — define `SettlementState`,
  role types, player↔role mapping helpers.
- [01.2-data-loaders.md](01.2-data-loaders.md) — typed loaders + zod-style
  validation for buildings / units / technologies JSON.
- [01.3-game-skeleton.md](01.3-game-skeleton.md) — replace `CardSweep` with
  `Settlement` game + `pass` move, wire `App.tsx` and `Board.tsx`, update
  title.
- [01.4-test-harness.md](01.4-test-harness.md) — generalize the headless test
  pattern from [tests/game.test.ts](../tests/game.test.ts) into a
  `makeClient()` helper used by every later stage.
- [01.5-claude-md-refresh.md](01.5-claude-md-refresh.md) — update
  [CLAUDE.md](../CLAUDE.md) to reflect the new `src/game/` module layout,
  the role subfolder convention, and the network-first stance.

## Test surface

- Loaders parse all bundled JSON without errors.
- `makeClient()` boots `Settlement` for any `numPlayers ∈ {1,2,3,4}` and yields
  the correct role assignment.
- `pass` advances to the next player.
