# Sub-phase 2.3 — `chiefFlipTrack` move + resolve algorithm

**Parent:** [phase-2](./defense-redesign-phase-2.md)
**Spec refs:** D5, D6, D7, D8, D9, D10, D13, D22 + sections §3 + §4 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 2.1 + 2.2 merged.

## Goal

Add the `chiefFlipTrack` move and the deterministic resolve
pipeline that runs immediately when a threat card is flipped.
Combat math is pure functions in a new `resolver.ts`; the move is
a thin wrapper around them.

After 2.3, flipping a threat does the right thing: units fire,
threat damages buildings, leftover hits center pool. Boons and
modifiers dispatch into the existing event system (or a new
modifier stack).

This sub-phase introduces the **largest** new logic block in the
redesign. Keep the resolver pure and tested in isolation.

## Files touched

- `src/game/roles/chief/flipTrack.ts` (new) — move
  `chiefFlipTrack`.
- `src/game/track/resolver.ts` (new) — pure path / fire / impact
  pipeline.
- `src/game/track/path.ts` (new) — path geometry helpers.
- `src/game/track/centerBurn.ts` (new) — pool-burn pure helper.
- `src/game/types.ts` — add per-round modifier stack
  (`G.track.activeModifiers: ModifierEffect[]`) if not already
  there.
- `src/game/bankLog.ts` — new entry kind: `centerBurn`.
- `src/game/phases/chief.ts` — register the move on the chief
  stage.
- `tests/game/track/resolver.spec.ts` (new) — extensive coverage.
- `tests/game/track/path.spec.ts` (new) — geometry coverage.
- `tests/game/roles/chief/flipTrack.spec.ts` (new) — move
  integration.

## The move

```ts
// src/game/roles/chief/flipTrack.ts
export const chiefFlipTrack: Move<SettlementState> = {
  client: false,
  move: ({ G, ctx, random, playerID }) => {
    if (playerID !== chiefSeat(G, ctx)) return INVALID_MOVE;
    if (G.track.upcoming.length === 0) return INVALID_MOVE;
    const card = advanceTrack(G.track);
    if (!card) return INVALID_MOVE;
    resolveTrackCard(G, random, card);
  },
};
```

The chief flips after their other actions but **before**
`chiefSeatDone`. Two ways to enforce this:

- **(a) Auto-flip**: have `chiefSeatDone` call `chiefFlipTrack`
  internally before transitioning. No new player-facing button.
- **(b) Explicit flip**: chief must call `chiefFlipTrack` before
  `chiefSeatDone`. Reject `chiefSeatDone` if the round's flip
  hasn't happened yet.

Spec D22 calls for chief to *visibly* flip the card as a table
moment. The UI in Phase 3 wants an explicit button. Recommend
**(b)**, with `chiefSeatDone` rejecting "flip not done yet" — the
Phase 3 panel surfaces the button as the last step.

## The resolver pipeline

```ts
// src/game/track/resolver.ts
export const resolveTrackCard = (
  G: SettlementState,
  random: RandomAPI,
  card: TrackCardDef,
): void => {
  switch (card.kind) {
    case 'boon':       return dispatchBoon(G, card.effect);
    case 'modifier':   return pushModifier(G, card);
    case 'threat':     return resolveThreat(G, random, card);
    case 'boss':       return resolveBoss(G, random, card);
  }
};
```

### `resolveThreat`

Implements §3 + §4 of the spec. Given a `ThreatCard`, do:

```
1. Compute the path (helpers in path.ts).
2. Compute the set of firing units (units whose Chebyshev range
   covers any tile on the path between entry and first impact).
3. Order firing units by first-strike (true before false), then by
   placement order. Apply each unit's printed bonuses (matchup +
   placementBonus[]) to its strength against this threat.
4. For each unit fire, deduct strength from the threat. If S <= 0
   on any step, threat dies — apply reward to bank, return.
5. If S > 0 after all units fire:
     - assign 1 HP damage to every unit that fired (the "repel"
       cost). Units at 0 HP are removed.
     - apply S damage to the impact tile, consuming the unit
       stack bottom-up (D13) before reducing building HP.
     - if S > 0 still, walk the path further toward center,
       repeating impact-tile resolution at the next occupied tile.
     - if path reaches center with S > 0, run centerBurn(G, random,
       S).
```

Spec details to honour:

- "Random but even split" pool burn: implemented in
  `centerBurn.ts`, which posts to `bankLog` as `centerBurn` kind.
- Stack consumption: bottom-up by placement order. Each unit
  absorbs up to its current HP before the next unit takes damage.
- Building HP can't go below 1. Yield prorate is read at next
  produce, no resolver-side computation needed.

### `resolveBoss` — defer to 2.7

A no-op stub here; 2.7 lands the boss logic. The stub validates
that boss thresholds are reachable but does nothing else.

### `dispatchBoon`, `pushModifier`

Boons reuse the existing event-effect dispatcher in
`src/game/events/`. If a boon effect is novel, add it to that
taxonomy.

Modifiers push onto `G.track.activeModifiers`; the resolver consumes
them at the start of the next threat fire and clears at end-of-round
(2.8).

## `path.ts` helpers

```ts
// Translate a (direction, offset, grid) into the ordered list of
// cells the threat traverses, from entry to center. Includes empty
// cells (the resolver iterates them).
export const computePath = (
  direction: Direction,
  offset: number,
  gridBounds: { minX: number; maxX: number; minY: number; maxY: number },
): { x: number; y: number }[];

// Subset of `computePath` that includes only cells with placed
// buildings (excluding center). The resolver uses this to find
// the first impact tile.
export const occupiedPath = (
  path: { x: number; y: number }[],
  grid: Record<string, DomesticBuilding>,
): string[];

// True if a tile (x, y) is within the given Chebyshev radius of
// any cell in `path`.
export const tileCoversPath = (
  unitTile: { x: number; y: number },
  range: number,
  path: { x: number; y: number }[],
): boolean;
```

`gridBounds` is a small bookkeeping struct kept on `G.domestic` (or
computed lazily) so the path doesn't extend to infinity. With the
center anchored at `(0,0)` and free-form placement, the bounds are
"current min/max occupied + 1" — enough margin for threats to start
just off the populated grid.

## Tests

Resolver unit tests (run on synthetic `G`, no full bgio client):

- One unit, one threat, range 1, threat at offset 0 from N: unit
  fires, threat dies if `unit.strength >= threat.strength`.
- Threat survives unit fire, hits a 3-HP building: building drops
  to `3 - leftover` HP.
- Two units stacked on a tile, threat overflows to the tile: first
  unit (oldest) absorbs first, then second.
- Threat reaches center: pool burn split is deterministic given a
  fixed seed.
- First-strike unit fires before non-first-strike unit on the same
  tile.
- Placement bonus applies: Sapper on Well gets +1 strength against
  all threats.
- Matchup text: a threat with `modifiers: ["Cavalry"]` triggers a
  unit's printed `+1 vs Cavalry` bonus.
- Boon: dispatches into the event system; bank gains the right
  resources.
- Modifier: pushed onto `activeModifiers` and applied to the next
  threat resolution within the same round.

Move integration:

- Chief flips with a non-empty track, advances `upcoming` by 1.
- `chiefSeatDone` rejects if flip hasn't happened.
- Empty track flip = `INVALID_MOVE`.

## Out of scope

- Defense-side moves to set up a meaningful battle (2.5).
- Boss resolution (2.7).
- Drill / teach buffs (2.6).
- UI for the resolution animation (Phase 3).

## Done when

- `chiefFlipTrack` is dispatchable from the headless test client.
- Resolver tests cover all paths above.
- A scripted run that flips 5 threats sequentially produces stable
  output across two runs with the same seed (determinism contract,
  spec D8).
- Phase 2.4 can wire the flip into the round shape without
  state-shape changes.
