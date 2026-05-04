# Sub-phase 1.5 — Win-condition placeholder + doc cleanup

**Parent:** [phase-1](./defense-redesign-phase-1.md)
**Spec refs:** D25, D26 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 1.1 + 1.2 + 1.3 + 1.4 merged.

## Goal

Close out Phase 1 by retiring the `settlementsJoined >= 10` win
check, replacing it with a placeholder that reflects the eventual
boss-resolves-to-win design, and updating user-facing docs to
reflect the new project state.

After 1.5, the project is in a clean, internally consistent
"between regimes" state: the old design is gone from code AND
docs; the new design is documented as "coming," and the only
end-of-game outcome is `turnCap` (= "time up").

## Files touched

- `src/game/endConditions.ts` — final retirement of
  `settlementsJoined`. Add an explicit `bossResolved: boolean`
  flag on `G` (default false) and have `endIf` return win when
  it's true. Until Phase 2.7 lands the boss, this flag is never
  set, so the only end-of-game outcome is the `turnCap` path
  (already in place).
- `src/game/types.ts` — add the `bossResolved` flag to
  `SettlementState`.
- `src/game/setup.ts` — initialize `bossResolved: false`.
- `src/game/index.ts` — barrel export hygiene.
- `tests/game/endConditions.spec.ts` — delete settlementsJoined
  tests; replace with a single "no win condition until boss is
  resolved" smoke test + a `turnCap` test.
- `docs/Rules.md` — major rewrite (see "Doc updates" below).
- `docs/game-design.md` — major rewrite of §3.4 / §3.5.
- `CLAUDE.md` — file-tree section + project-stance bullets.

## Concrete changes

### `endConditions.ts`

```ts
export const endIf = ({ G, ctx }: { G: SettlementState; ctx: Ctx }) => {
  if (G.bossResolved) return { won: true };
  if (G.round >= G.turnCap) return { won: false, reason: 'timeUp' };
  return undefined;
};
```

Score recording in `onEnd` stays. The score schema may want
adjustment (rounds-taken, HP-retained, units-alive); leave it as
the existing shape until Phase 2.7 wires real data in.

### Doc updates

`docs/Rules.md` — rewrite §5.2.3 (foreign), §5.3 (combat resolver),
§5.2.4 (trade-request), §5.4 (end-of-round), §6 (win condition).
Replace with placeholders that say:

- §5.2.3: "Defense — coming. The role exists as a stub during
  development; see plans/."
- §5.3: deleted; combat math will be re-described in Phase 2.
- §5.2.4: deleted.
- §5.4: end-of-round still wanders today (NOTE: wander deck stays
  for the duration of Phase 1; Phase 2 retires it when the track
  lands).
- §6: "Win condition — coming. Currently only `turnCap` ends the
  game."

`docs/game-design.md` — replace §3.4 with a one-line pointer:

> **3.4 Defense (formerly Foreign).** The role is mid-redesign;
> see [reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md)
> for the locked decisions and the plans/ directory for staged
> implementation.

Update §3.5 (opponent / wander) to acknowledge the wander deck is
end-of-life — it'll be folded into the global event track in
Phase 2 (D19, D20, G3).

`CLAUDE.md` — file-tree section under "Layout you should know"
needs the `foreign` paths struck through and `defense` paths added.
Project-stance bullets stay correct (no fail mode, network primary,
etc.). The "When changing the game" section that mentions
`roles/foreign/` and `battleResolver` references gets pruned to
the smaller set of role files Phase 1 leaves behind.

## Test plan

- `endIf` returns `{ won: true }` when `G.bossResolved = true` (set
  manually in test).
- `endIf` returns `{ won: false, reason: 'timeUp' }` at
  `round >= turnCap`.
- `endIf` returns `undefined` otherwise.
- A 4-bot RandomBot fuzz run terminates within `turnCap` rounds and
  records a score. (Existing fuzz harness — sanity check it still
  works.)

## Done when

- `endConditions.ts` is the new shape.
- `Rules.md` and `game-design.md` no longer contain self-
  contradicting passages from the old foreign design.
- A grep for `settlementsJoined`, `tradeRequest`, `BattleInFlight`
  across `src/`, `tests/`, and `docs/` returns no current references
  (only this report and the plans files mention them historically).
- All checks (`typecheck`, `lint`, `test`, `build`) pass.
- The `e2e:smoke` test still completes; it now ends in `timeUp`
  rather than `won`. That's expected for the duration between 1.5
  and Phase 2.7.

## Phase 1 closeout

After 1.5 merges, Phase 1 is complete. The project is in a
defensible intermediate state where:

- the schema is ready for Phase 2,
- the center tile is in place,
- buildings have HP and a repair move,
- nothing references the old foreign loop,
- the win condition is "boss resolved (never set yet)" or
  `turnCap`,
- the docs accurately describe this in-between state.

Phase 2 then builds the track, the resolver, defense moves, the
science Drill / Teach moves, and the boss — flipping
`bossResolved` to `true` in 2.7 to make the win path live again.
