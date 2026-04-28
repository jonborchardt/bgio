# 04 — Role: Chief

## Goal

The Chief turn from game-design.md §Chief: sweep mat → optional gold-event →
distribute resources → optional worker placement → hand off to others.

## Scope

**In:**
- `chiefPhase` `onBegin`: take leftover mat resources into the bank (already
  partially handled by the round-end hook from 03; reconfirm it runs at the
  right time).
- Move: `chiefDistribute(playerID, resources)` — places resources from bank
  into a target player's circle. Validates: chief is current, source has
  enough, target is a non-chief seat.
- Move: `chiefPlayGoldEvent(cardID)` — placeholder; real event content lives
  in stage 08. Move exists so the wire is in place.
- Move: `chiefPlaceWorker(domesticSlotID)` — placeholder until Domestic's grid
  exists; gated behind a feature flag until 06.
- Move: `chiefEndPhase()` — explicit phase end that triggers `othersPhase`.

**Out:**
- The actual gold-event card library (stage 08).
- Worker effects on production (Domestic).
- Option 2 "play 2x this turn" power (a future sub-plan).

## Depends on

01, 02, 03.

## Sub-plans

- [04.1-distribute-move.md](04.1-distribute-move.md) — implement and test
  `chiefDistribute`.
- [04.2-end-phase.md](04.2-end-phase.md) — `chiefEndPhase` move + transition
  into `othersPhase` with the right `activePlayers` map.
- [04.3-worker-placement-stub.md](04.3-worker-placement-stub.md) — declare
  the move shape; mark as blocked-on-06.
- [04.4-gold-event-stub.md](04.4-gold-event-stub.md) — declare the move
  shape; mark as blocked-on-08.
- [04.5-panel.md](04.5-panel.md) — minimal Chief UI panel (resource picker
  per target seat, "End my turn" button). MUI primitives only, theme tokens.

## Test surface

- Distribute moves never let the bank go negative.
- Non-chief players cannot call `chiefDistribute`.
- `chiefEndPhase` lands the game in `othersPhase` with all non-chief seats
  active.
