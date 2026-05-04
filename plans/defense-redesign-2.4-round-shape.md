# Sub-phase 2.4 — Round shape and phase wiring

**Parent:** [phase-2](./defense-redesign-phase-2.md)
**Spec refs:** D22 + §6 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 2.1 + 2.2 + 2.3 merged.

## Goal

Wire the **chief → flip/resolve → others mitigate** round shape
into bgio's phase machinery so flipping the track happens between
chief's solo turn and the parallel others phase.

This is small in code but high-stakes: getting the phase
transitions wrong means moves race or the flip doesn't happen at
all. Treat it carefully.

## Files touched

- `src/game/phases/chief.ts` — gate `chiefSeatDone` on `flipDone`.
- `src/game/phases/others.ts` — no change to the activePlayers
  setup, but add a precondition: others phase should not begin
  unless the previous chief phase set `flipDone = true`.
- `src/game/types.ts` — `G.track.flipDone: boolean` per round
  (cleared at round-start).
- `src/game/hooks.ts` — register a round-end hook to clear
  `flipDone`.
- `src/game/roles/chief/seatDone.ts` — assert `flipDone` (or
  auto-flip if missing — see decision below).
- `tests/game/phases/round.spec.ts` (extend) — confirm round shape.

## Concrete sequencing

```
chief phase begins (turn.onBegin in phases/chief.ts)
  → bank stipend
  → sweep `out` to bank
  → set track.flipDone = false
  → chief acts (any order):
      - distribute / pull-back
      - place workers
      - play 1 gold event
      - chiefFlipTrack    ← MUST happen at some point
  → chiefSeatDone
      - if !track.flipDone: INVALID_MOVE (force chief to flip)
      - else: in.drains to stash, advance to others phase
  → flipDone is true. The flip already resolved (2.3).

others phase begins
  → for each non-chief seat: in.drains again? (no — already done at
    end of chief phase). Confirm in current phases/others.ts.
  → domestic auto-produce
  → defense regen tick
  → seats act in parallel.
  → each seat ends.

end of round
  → wander (still active until 2.8 retires it)
  → reset track.flipDone (round-end hook)
  → reset per-seat per-round flags
  → round counter increments
```

## Decision: chiefSeatDone gating

Two options:

- **(a)** `chiefSeatDone` rejects until `flipDone === true`. The
  Phase 3 panel surfaces "Flip Track" as the literal last step;
  this is unambiguous to the table.
- **(b)** `chiefSeatDone` auto-flips if not yet flipped, before
  draining `in` to `stash`. Robust to UI lapses, but the player
  doesn't get the visual moment.

Recommend (a). Spec D22 wants the chief flipping the card to be a
*table moment* — the player should explicitly trigger it. Phase 3's
chief panel will surface the button prominently, and the rejection
text is a clear UX hint.

## Error message hygiene

When `chiefSeatDone` rejects on missing flip, surface a usable
message via the existing INVALID_MOVE feedback channel:

```
"You must flip the track card (chiefFlipTrack) before ending your phase."
```

UI can read the message and show it next to the seat-done button.

## Tests

- A bot run completes a chief phase: distribute → flip → seatDone
  → others phase begins. Assert `track.flipDone` is true at the
  transition.
- `chiefSeatDone` is rejected when `flipDone` is false.
- `chiefFlipTrack` after `chiefSeatDone` is rejected (chief has
  exited the phase).
- Multi-round: round-end hook clears `flipDone`, next round's
  chief phase requires another flip.
- Determinism: a 4-bot run, with the same seed, produces the same
  track history across two runs.

## Out of scope

- Defense's actual moves (2.5).
- Boss resolution (2.7).
- Wander deck retirement (2.8 — folded into the track).
- UI for the flip button (Phase 3).

## Done when

- The phase machinery enforces flip-then-end on the chief turn.
- Tests confirm the round shape matches spec D22.
- Phase 2.5 / 2.6 can land defense + science moves on top of a
  stable round structure.
