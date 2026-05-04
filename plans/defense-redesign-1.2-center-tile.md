# Sub-phase 1.2 — Center tile

**Parent:** [phase-1](./defense-redesign-phase-1.md)
**Spec refs:** D2, D3, D4 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 1.1 must be merged.

## Goal

Plant a permanent center tile at `(0, 0)` on the domestic grid. It
becomes the anchor for all coordinate-based reasoning (threat
direction + offset, range queries) and the always-present terminal
target for any threat path. Burn-on-hit is **not** wired in this
sub-phase — that's Phase 2 (the resolver) — only the tile's
existence and placement-rule integration land here.

## Files touched

- `src/game/roles/domestic/types.ts` — `DomesticBuilding` gains an
  optional `isCenter?: true` flag, OR introduce a small union type.
  Lean toward a flag for minimum diff.
- `src/game/roles/domestic/grid.ts` — `setupDomestic` plants `(0,0)`
  with an `isCenter: true` building. `isPlacementLegal` already
  treats orthogonal-adjacency-to-existing as legal, which works
  because center is already there.
- `src/data/buildings.json` — add a single `Center` building def
  used only for the seeded tile (or hard-code its def in
  `setupDomestic` and skip the JSON entry — see "Open question"
  below).
- `tests/game/roles/domestic/grid.spec.ts` — add tests for
  setup-with-center + first-real-build-must-touch-center.

## Concrete changes

### State

```ts
interface DomesticBuilding {
  defID: string;
  upgrades: number;
  worker: { ownerSeat: PlayerID } | null;
  hp: number;             // landing in 1.3, but reserve here
  maxHp: number;          // landing in 1.3, but reserve here
  isCenter?: true;        // NEW — only set on the (0,0) tile
}
```

`isCenter` is a tag, not a separate type, so existing code that
walks `grid` keeps working. Code paths that care (Phase 2's
resolver, the repair move in 1.3) will check the flag.

### Setup

```ts
export const setupDomestic = (techsAlreadyUsedBy?: Set<string>): DomesticState => {
  // ...existing hand seeding...
  const grid: Record<string, DomesticBuilding> = {};
  grid[cellKey(0, 0)] = {
    defID: 'Center',
    upgrades: 0,
    worker: null,
    hp: 99,           // unused — center can't take damage
    maxHp: 99,        // unused
    isCenter: true,
  };
  return { hand, grid };
};
```

The center is **not** repairable, **not** producible, **not**
upgradeable. Existing produce / upgrade / repair moves must skip
it; assertions to verify in tests.

### Placement

`isPlacementLegal` already permits placement next to *any* existing
grid key. Because center is now in the grid from the start, the
first real domestic placement must be orthogonally adjacent to
center. This is the desired behavior — no code change to
`isPlacementLegal` required, just add tests.

A hardening change *should* land alongside: refuse to place a
non-center building **on** `(0,0)` (the cell is already occupied,
which `isPlacementLegal` already rejects, but it's worth an
explicit assertion).

### Production / repair gating

For 1.2, the only required change in `produce.ts` and (future)
`repair.ts` is to **skip cells where `isCenter`**. Keeps the center
tile inert.

## Test plan

- `setupDomestic` produces a grid with exactly one cell, at `(0,0)`,
  flagged `isCenter`.
- A first real domestic build at `(1, 0)` succeeds.
- A first real domestic build at `(2, 0)` (not adjacent to center)
  is rejected.
- A second real domestic build at `(1, 1)` succeeds (adjacent to
  the first real building).
- Production tested in 1.3 (yield from center = 0). Skip here.
- The center tile cannot be replaced or overwritten.

## Open question

**Does Center get a JSON entry in `buildings.json`?**

- (a) **Yes.** Treat it as a real `BuildingDef` with `cost: 0`,
  `yield: ''`, `maxHp: 99`. Pros: clean data path. Cons: a
  marker building sneaks into the buy/place hand if not
  filtered.
- (b) **No.** Hard-code the center in `setupDomestic` and have
  the resolver / repair / produce code special-case
  `isCenter`. Pros: no synthetic entry. Cons: a magic tile
  outside the data path.

Recommend (b). The center is genuinely special — it's a coordinate
anchor, not a building — and the special-casing is centralised in
~3 spots.

## Done when

- The grid always has a center tile from setup.
- First real placement is constrained to be adjacent to center.
- `npm run typecheck`, `npm run lint`, `npm test` pass.
- Phase 1.3 can land on top without retrofits.
