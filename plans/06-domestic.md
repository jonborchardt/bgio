# 06 — Role: Domestic

> **Status: done** (all sub-plans landed; see
> [STATUS.md](STATUS.md) for the canonical per-row state).

## Goal

Implement game-design.md §Domestic: building hand, in-play grid (with optional
adjacency effects), buy / upgrade / produce.

Default to **Option 1** (adjacency matters, free-form grid). Option 2
(no-adjacency) is a config flag toggleable per game.

## Scope

**In:**
- Setup: hand starts with all level-0 tech cards not used by Science.
- State:
  - `hand: BuildingCard[]`
  - `grid: Map<{x,y}, BuildingCard>` — adjacency-aware placement
  - `workers: Map<{x,y}, WorkerToken>` — placed by Chief
- Moves:
  - `domesticBuyBuilding(cardID, {x,y})` — pay cost from circle, place in
    grid; placement must touch existing building unless grid empty.
  - `domesticUpgradeBuilding({x,y}, upgradeCardID)` — replace with upgraded
    version, paying delta cost.
  - `domesticProduce()` — atomic round-end-style move: sum `benefit` of every
    in-play building, plus worker bonuses, deposit into bank.
  - `domesticPlayGreenEvent(cardID)` — placeholder; see 08.
- Reads source data from
  [buildings.json](../src/data/buildings.json) for cost/benefit text;
  benefit-string parsing is its own sub-plan.

**Out:**
- Option 4 (column/row defense matters) — only relevant after Foreign Option
  4 lands.

## Depends on

01, 02, 03.

## Sub-plans

- [06.1-hand-and-grid.md](06.1-hand-and-grid.md) — state + placement
  validation.
- [06.2-buy-and-upgrade.md](06.2-buy-and-upgrade.md) — purchase / upgrade
  moves.
- [06.3-benefit-parser.md](06.3-benefit-parser.md) — turn
  `"2 food and 1 production"` strings into typed yields. Pure function,
  table-driven.
- [06.4-produce-move.md](06.4-produce-move.md) — atomic production into bank.
- [06.5-adjacency-rules.md](06.5-adjacency-rules.md) — pluggable
  adjacency-effect registry. Adjacency is real V1 gameplay, not cosmetic.
- [06.6-event-stub.md](06.6-event-stub.md) — `domesticPlayGreenEvent`.
- [06.7-panel.md](06.7-panel.md) — Domestic UI: hand row + grid drop
  targets.
- [06.8-adjacency-content.md](06.8-adjacency-content.md) — initial pass of
  adjacency rule content (AI-assisted authoring) so the registry isn't
  empty at V1 launch.

## Test surface

- First building can be placed anywhere; subsequent placements must be
  orthogonally adjacent.
- Upgrade requires paying only the delta cost, not full cost.
- `domesticProduce` is idempotent within a round and matches the parsed
  benefit table.
- Worker bonuses stack with default benefit, never replace it.
