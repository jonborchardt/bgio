# Sub-phase 1.4 — Retire the old foreign loop, rename to defense

**Parent:** [phase-1](./defense-redesign-phase-1.md)
**Spec refs:** D1, D14 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 1.1 + 1.2 + 1.3 merged.

## Goal

Delete every code path tied to the old foreign loop — battle deck,
trade requests, upkeep, recruit, release, allocate damage, the
resolver — and rename the role's folder + types from `foreign` to
`defense`. After this sub-phase the role exists as a stub: the
panel renders, end-my-turn dispatches, and nothing else. Phase 2
fills it in.

This is the largest single sub-phase in Phase 1. Order the
deletions carefully so the codebase compiles after each commit.

## Files deleted

```
src/game/roles/foreign/release.ts
src/game/roles/foreign/flip.ts
src/game/roles/foreign/assignDamage.ts
src/game/roles/foreign/tradeFulfill.ts
src/game/roles/foreign/tradeRequest.ts
src/game/roles/foreign/upkeep.ts
src/game/roles/foreign/undoRelease.ts
src/game/roles/foreign/battleResolver.ts
src/game/roles/foreign/playRedEvent.ts (folded into generic event dispatcher; keep if shared, delete if unique)
src/game/roles/foreign/recruit.ts
src/game/roles/foreign/abilities.ts
src/game/roles/foreign/decks.ts (battle + trade decks both go)
tests/game/roles/foreign/battleResolver*.spec.ts (all of them)
tests/game/roles/foreign/recruit*.spec.ts
tests/game/roles/foreign/upkeep*.spec.ts
tests/game/roles/foreign/release*.spec.ts
tests/game/roles/foreign/flip*.spec.ts
tests/game/roles/foreign/assignDamage*.spec.ts
tests/game/roles/foreign/tradeFulfill*.spec.ts
tests/game/roles/foreign/tradeRequest*.spec.ts
tests/game/roles/foreign/undoRelease*.spec.ts
src/data/battleCards.json + .ts
src/data/tradeCards.json + .ts
src/ui/foreign/AssignDamageDialog.tsx
src/ui/foreign/Decks.tsx
src/ui/foreign/BattlePanel.tsx
src/ui/foreign/Army.tsx
```

The list is long. Delete in this order to minimize broken interim
states:

1. UI files first (they only depend on game state, removing them
   doesn't break the game).
2. Tests next (their fixtures stop being needed once moves are
   gone).
3. Move files (`recruit`, `upkeep`, `flip`, `assignDamage`,
   `release`, `undoRelease`, `tradeFulfill`, `tradeRequest`).
4. The resolver (`battleResolver.ts`) and abilities (`abilities.ts`).
5. The data files (`battleCards`, `tradeCards`).

## Files renamed `foreign` → `defense`

```
src/game/roles/foreign/types.ts → src/game/roles/defense/types.ts
src/game/roles/foreign/seatDone.ts → src/game/roles/defense/seatDone.ts
src/game/roles/foreign/playTech.ts → src/game/roles/defense/playTech.ts (likely deleted then rewritten in Phase 2.5)
src/ui/foreign/ForeignPanel.tsx → src/ui/defense/DefensePanel.tsx
tests/game/roles/foreign/seatDone.spec.ts → tests/game/roles/defense/seatDone.spec.ts
```

## Files edited (cross-references to update)

These files all reference the foreign types / moves / state and
need surgical updates:

- `src/game/index.ts` — barrel exports. Remove deleted symbols,
  re-export defense from the renamed module.
- `src/game/types.ts` — `ForeignState` → `DefenseState`. Remove
  `BattleInFlight`, `tradeRequest`, `pendingTribute`,
  `lastBattleOutcome`, `_upkeepPaid`. Defense state shrinks to
  `{ hand, techHand?, inPlay }` for now (instances of
  `inPlay` lose their old shape — see below).
- `src/game/setup.ts` — drop battle / trade deck construction. Set
  up the new defense state shape (still mostly empty).
- `src/game/playerView.ts` — drop the `centerMat.tradeRequest`
  redaction; drop any `foreign.*` branch that referenced removed
  fields.
- `src/game/endConditions.ts` — remove the `settlementsJoined >= 10`
  win check. Until 1.5 lands the placeholder, fall back to "win =
  never" so the only end is `turnCap` (= "time up"). Document this
  is intentional and temporary.
- `src/game/phases/others.ts` — keep the foreign → defense stage,
  rename, but its move list shrinks to just `defenseSeatDone`.
- `src/game/phases/stages.ts` — rename stage names.
- `src/game/hooks.ts` — drop any foreign-only hooks (e.g.
  end-of-round upkeep tracking).
- `src/game/roles/domestic/parseBenefit.ts` — drop the
  `unitMaintenance` and `unitCost` parsers (Walls −2, Tower −4,
  Forge −1). Walls / Tower / Forge stay as building defs but their
  unit-targeted bonuses are gone (D18 puts those on units).
- `src/game/roles/domestic/upgrade.ts` — drop any references to
  foreign cost reductions.
- `src/game/ai/*` — drop foreign-specific enumerator if any. Defense
  enumerator returns `[]` until Phase 2.5.
- `src/data/index.ts` — drop `BATTLE_CARDS`, `TRADE_CARDS`
  exports.
- `src/ui/Board.tsx` and the role-panel router — point at
  `DefensePanel` (stub).
- `tests/helpers/seed.ts` — drop foreign battle / trade fixtures.
- Anywhere else `grep`/Grep finds `foreign` (skip strings inside
  user-facing copy / `Rules.md` until 1.5 lands).

### `UnitInstance` reshape

The current shape:

```ts
interface UnitInstance {
  defID: string;
  count: number;
}
```

This is a count-collapsed view that worked for the old battle
resolver. Phase 2 will need per-instance state (HP, drill marker,
taught skills, placement cell). For 1.4, leave `count` in place if
nothing else uses it, OR pre-rename to the Phase 2 shape:

```ts
interface UnitInstance {
  id: string;            // synthetic uuid for stack ordering
  defID: string;
  cellKey: string;       // building tile placement (D11)
  hp: number;            // current
  placementOrder: number;// monotonic, used for first-in-first-killed
  drillToken?: boolean;  // landing in 2.6
  taughtSkills?: SkillID[];
}
```

I lean toward landing the new shape in 1.4 since 1.4 is the
"we're touching defense state anyway" sub-phase. Phase 2 then
just *reads* the fields; it doesn't reshape them.

## Tests

- Delete the test files listed above.
- Update `tests/helpers/seed.ts` and `tests/helpers/runMoves.ts`
  to no longer reference removed moves.
- Add a smoke test: `tests/game/setup.spec.ts` confirms a fresh
  match has no `tradeRequest` slot, no battle / trade deck, and a
  defense state of the new shape.
- Keep the existing **chief / science / domestic** tests running.

## CLAUDE.md / Rules.md

Don't update copy yet — the doc updates land in 1.5 (along with
the win-condition placeholder). Code referenced in CLAUDE.md (file
paths, layout list) is updated to the new file tree as part of
this sub-phase, since file paths in CLAUDE.md will go stale.

## Done when

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
  all pass.
- The hot-seat client renders end-to-end. Defense panel shows a
  stub message ("Defense — coming in Phase 2") and an "End my
  turn" button.
- No references remain to `foreign`, `battle*`, `trade*` in
  `src/`. (Use Grep with `\\bforeign\\b` to confirm; allow
  matches inside user-facing copy in `docs/Rules.md` and
  `docs/game-design.md` until 1.5.)
- Existing chief / science / domestic plays of a partial game
  still work in the hot-seat browser.
