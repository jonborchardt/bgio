# Phase 1 — Foundations: schema, center tile, building HP, retire old foreign

**Source spec:** [reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Status:** outline. Sub-phase plans (`1.1`, `1.2`, …) live as
sibling files and break this down further.

## What this phase does

Phase 1 is the **demolition + scaffolding** step. It changes the
content schema, plants the center tile, gives every building HP +
repair, and rips the old foreign role out of the codebase, while
keeping the game compilable + playable as a degraded state at every
sub-phase boundary.

After Phase 1, the project is in a known intermediate state:

- The old battle / trade / upkeep loop is gone.
- Buildings have HP and can be repaired; production prorates.
- `BuildingDef.maxHp` and `UnitDef.placementBonus[]` are first-class.
- The center tile sits at `(0,0)` and never goes away.
- There is **no track yet** and Defense has no replacement moves —
  the role is intentionally inert. Phase 2 will fill that in.

The game will still load, type-check, lint, and run end-to-end (with
Defense doing essentially nothing). This is intentional: Phase 1
guarantees we don't ship a half-renamed role.

## What this phase does NOT do

- No track plumbing (`Phase 2`).
- No new defense moves (`Phase 2`).
- No new win condition (`Phase 2`).
- No new science moves (`Phase 2`).
- No UI for any of the new mechanics (`Phase 3`).

Phase 1 is purely server-state shape changes + deletions.

## Sub-phases (initial breakdown — to be expanded in their own files)

1. **1.1 — Content schema extensions.** Add `maxHp` to
   `BuildingDef`, add `range / regen / firstStrike / placementBonus`
   to `UnitDef`. Update JSON loaders. Add minimal data so existing
   tests still pass.
2. **1.2 — Center tile.** Pre-seed `(0,0)` in `setupDomestic`. Update
   `isPlacementLegal` so the first real building must touch center.
   Add a `centerTile` marker so the cell is identifiable as the
   anchor. Add tests.
3. **1.3 — Building HP + repair.** Extend `DomesticBuilding` with
   `hp` / `maxHp`. Add `domesticRepair`. Prorate `produce.ts`. Wire
   tests.
4. **1.4 — Retire old foreign loop.** Delete
   `release.ts`, `flip.ts`, `assignDamage.ts`, `tradeFulfill.ts`,
   `tradeRequest.ts`, `upkeep.ts`, `undoRelease.ts`,
   `battleResolver.ts`, the trade-deck side of `decks.ts`, the
   `BattleInFlight` slot, etc. Rename folder `roles/foreign/` →
   `roles/defense/`. Strip references from `playerView`, `endIf`,
   `onEnd`, types. Defense becomes a stub role with no moves.
5. **1.5 — Win-condition placeholder.** Retire `settlementsJoined`
   from the win check. Until Phase 2 adds the real boss-win check,
   the only end condition is the `turnCap`. Tests adjusted.

Sub-phase ordering rationale: 1.1 first because schema needs a
landing pad before anything else uses it. 1.2 + 1.3 parallel-able
but cleaner sequenced. 1.4 last among "additive" moves — once we
delete the old foreign code we want everything else to already be
in place. 1.5 closes the door on `settlementsJoined`.

## Exit criteria for Phase 1

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
  all pass.
- Hot-seat client loads, renders the village, lets the chief
  distribute and end their phase, lets domestic buy/place/repair,
  and lets science contribute / complete cards.
- Defense's panel shows "Awaiting Phase 2" or similar — not broken.
- An end-of-game still happens (via turnCap), even if it's a "time
  up" outcome every game.

## Risks / open spots flagged for sub-phase planning

- **Tests under `tests/game/roles/foreign/`** — most go away in 1.4.
  Decide per-file: delete vs. adapt. The damage-allocation tests
  are pure resolver and can be deleted. The recruit / upkeep tests
  can be deleted once their feature is gone.
- **`tests/helpers/seed.ts`** likely seeds foreign state. Update
  alongside 1.4.
- **`server/`** — does any server file reference the foreign types
  directly? Phase 1.4 must touch any place that does.
- **`ai.enumerate` for foreign** — gone in 1.4. Bot will sit idle
  on Defense seat until Phase 2.
