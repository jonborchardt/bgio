# 07 — Role: Foreign

## Goal

Implement game-design.md §Foreign: army management, deterministic battles
against the Battle deck, and Trade-deck pulls that place trade requests on
the center mat.

Default to **Option 1** (single-card battles, simple stats). Options 2–8 are
explicit future work; the engine should not preclude them.

## Scope

**In:**
- Setup:
  - Build Battle deck and Trade deck per game-design.md §Setup (sort by
    number, randomize within ties, stack high-numbers at bottom).
  - Start with level-0 Militia hand and a Civilian Guard in play.
- State:
  - `hand: UnitCard[]`
  - `inPlay: UnitInstance[]` — multiples of the same unit allowed; engine
    tracks count rather than duplicating cards.
  - `battleDeck`, `tradeDeck` — opaque decks (only Foreign sees order via
    `playerView`).
- Moves:
  - `foreignUpkeep()` — pay maintenance to bank for every in-play unit;
    `foreignReleaseUnit(instanceID)` for the alternative.
  - `foreignRecruit(unitID)` — pay cost from circle, add an instance to
    `inPlay` (or increment count).
  - `foreignFlipBattle()` — deal a Battle card; resolve deterministically.
  - `foreignAssignDamage(allocation)` — during a flipped battle, the player
    distributes incoming damage across their committed units. Units must
    take lethal damage unless leftover < unit health.
  - `foreignFlipTrade()` — only on a successful battle; place result on the
    mat (or ends turn early).
  - `foreignEndPhase()` — explicit; ends round.
- Reads source data from [units.json](../src/data/units.json) for cost / stats
  / specials. Special abilities (focus, splash, armor, heal, …) are typed
  effect tags resolved by a battle resolver module.

**Out:**
- Options 2–8 — listed but not built. Each becomes its own sub-plan if
  pursued.
- The actual content of Battle / Trade deck cards beyond initiative-based
  targeting; will need its own JSON file at sub-plan time.

## Depends on

01, 02, 03.

## Sub-plans

- [07.1-decks.md](07.1-decks.md) — Battle / Trade deck construction +
  secret-state hook.
- [07.2-units.md](07.2-units.md) — `inPlay` tracking, recruit, upkeep,
  release.
- [07.3-battle-resolver.md](07.3-battle-resolver.md) — pure deterministic
  resolver: initiative order, ability tags (focus, splash, armor, heal, ammo,
  cover, single-use), damage allocation rules. Heavily unit-tested.
- [07.4-flip-flow.md](07.4-flip-flow.md) — `foreignFlipBattle` /
  `foreignAssignDamage` / `foreignFlipTrade` move sequence with stage-based
  permission gates.
- [07.5-trade-request.md](07.5-trade-request.md) — placing a flipped trade
  request on the mat; integrates with 03's center-mat slot.
- [07.6-event-stub.md](07.6-event-stub.md) — `foreignPlayRedEvent`.
- [07.7-panel.md](07.7-panel.md) — Foreign UI: army row, decks, in-flight
  battle panel.

## Test surface

- Battle resolver is deterministic given inputs (no `random` calls inside).
- Damage allocation validation: cannot dribble sub-lethal damage onto a unit
  unless leftover < unit health.
- Failing a battle ends the phase exactly per the rules.
- Only one trade request can sit on the mat; flipping a second triggers
  Chief's discard decision.
