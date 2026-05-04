# Sub-phase 2.8 — End-of-round hooks + wander retirement

**Parent:** [phase-2](./defense-redesign-phase-2.md)
**Spec refs:** §6 (round shape), G3 (wander folded into track) in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** All of 2.1–2.7 merged.

## Goal

Tidy up the round-end hooks: regen units, clear per-round flags,
clear unconsumed modifier-card effects, and retire the wander
deck (its role is now played by track boon cards).

This is a small sub-phase but closes Phase 2 cleanly.

## Files touched

- `src/game/hooks.ts` — register the new round-end hooks.
- `src/game/phases/endOfRound.ts` — drop the wander flip.
- `src/data/wanderCards.json` + loader — **delete** (content folded
  into trackCards.json).
- `src/game/wander/*` — delete the directory if it exists as a
  standalone area.
- `src/game/types.ts` — `wanderDeck`, `wanderDiscard` etc. removed
  from `SettlementState`.
- `src/game/setup.ts` — drop wander deck construction.
- `tests/game/wander/*.spec.ts` — delete.
- `docs/Rules.md`, `docs/game-design.md` — pass over the wander
  references and replace with track boon-card references.

## End-of-round hook chain (final)

```
Round-end hook order (registered via registerRoundEndHook):
  1. defense:regen-units      — apply unit.regen, capped at maxHp.
  2. defense:clear-modifiers  — clear `track.activeModifiers`
                                (one-round modifier cards expire).
  3. defense:clear-flags      — `_drillToken` is consumed at fire,
                                NOT at round-end (spec: "persist
                                until consumed").
  4. science:clear-flags      — `scienceDrillUsed`,
                                `scienceTaughtUsed` reset.
  5. domestic:clear-flags     — `producedThisRound` reset (existing).
  6. chief:clear-flags        — `track.flipDone` reset.
  7. round:advance            — round counter ++.
```

Order matters in only one place: regen happens first so dead-this-
round units don't regen, but units alive at end of round absorb
the regen tick before next round's combat.

## Wander deck retirement

The wander deck currently flips one card per round at end of
round. That role is now the track:

- Track boon cards (D20) provide the +bank-resource / +event
  effect that wander used to.
- Track modifier cards provide the "rules bend for one round"
  effect that some wander cards did.

Action: delete the wander code path entirely. Move any unique
flavor / effect that hasn't been replicated in `trackCards.json`
into a track boon card. (This is content migration — most wander
effects translate directly.)

## Tests

- Regen: a unit at hp 1/3 with regen 1 ends the round at hp 2/3.
  At hp 3/3, regen is a no-op.
- Modifiers: a one-round `doubleScienceCost` modifier flipped
  this round is consumed by end-of-round.
- Drill markers: a unit that was drilled but didn't fire keeps
  the marker into the next round.
- Science flags: a science seat that used Drill or Teach this
  round can do so again next round.
- Wander deck: setup no longer produces a `G.wanderDeck`; tests
  that exercised it are deleted.
- Round counter: increments correctly after all hooks run.

## Doc cleanup

`docs/Rules.md`: §5.4 (end-of-round) drops the wander step;
mentions the track flip happened earlier in the round (chief
phase boundary, §5.1.5 or wherever you land it after the §5.x
rewrite).

`docs/game-design.md`: §3.5 (opponent / wander) replaced with a
pointer to the track. The wander option-2 alternative comment is
moot.

`CLAUDE.md`: file-tree references to `src/game/wander/` removed.

## Done when

- Phase 2 ends with a fully populated end-of-round hook chain.
- Wander code is gone; equivalent content lives on the track.
- A 4-bot game completes from setup to win (or timeout) without
  errors and posts a sensible end-of-game state.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`,
  `npm run e2e:smoke` all pass.

## Phase 2 closeout

After 2.8 merges, Phase 2 is complete. The mechanics are real
end-to-end:

- Track flips, threats resolve, units fire deterministically.
- Defense buys / places / plays tech. Science drills / teaches.
- Center burns when threats reach the middle.
- Boss resolves, win check fires, score is recorded.
- Wander deck is retired; the track owns global pressure.

Phase 3 then makes all of it visible to a human player.
