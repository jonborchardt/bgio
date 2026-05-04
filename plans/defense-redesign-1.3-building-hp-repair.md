# Sub-phase 1.3 — Building HP and repair

**Parent:** [phase-1](./defense-redesign-phase-1.md)
**Spec refs:** D15, D16, D17 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 1.1 + 1.2 merged.

## Goal

Give every placed (non-center) building **HP / maxHp** state, prorate
production by damage, and add a `domesticRepair` move so domestic can
spend stash to restore HP. This is the loop the future track will
push damage into; Phase 2's resolver will produce the damage events.

This sub-phase introduces a damage state the game doesn't yet know
how to *generate* — that's intentional. Tests dispatch damage by
directly setting `building.hp` so we can verify the repair + produce
math without the full resolver.

## Files touched

- `src/game/roles/domestic/types.ts` — `DomesticBuilding` gains
  `hp: number` and `maxHp: number` as required fields.
- `src/game/roles/domestic/buy.ts` — initialize `hp` and `maxHp` at
  placement time (`maxHp = def.maxHp`, `hp = maxHp`).
- `src/game/roles/domestic/produce.ts` — prorate yield by
  `damagePct = (maxHp - hp) / maxHp`.
- `src/game/roles/domestic/repair.ts` (new) — `domesticRepair`
  move.
- `src/game/roles/domestic/seatDone.ts` — no change.
- `src/game/phases/stages.ts` — register `domesticRepair` on the
  domestic stage.
- `tests/game/roles/domestic/produce.spec.ts` — add prorate tests.
- `tests/game/roles/domestic/repair.spec.ts` (new) — coverage.
- `src/ui/domestic/DomesticPanel.tsx` — small visual stub of HP
  display (full UI lives in Phase 3, but a console-readable stub
  helps).

## Concrete changes

### State

```ts
interface DomesticBuilding {
  defID: string;
  upgrades: number;
  worker: { ownerSeat: PlayerID } | null;
  hp: number;         // current
  maxHp: number;      // BuildingDef.maxHp at placement time
  isCenter?: true;
}
```

### `domesticBuy` (and any existing placement path)

At placement: `hp = maxHp = BUILDINGS.find(b => b.name === defID).maxHp`.
For the center tile (1.2), `maxHp = 99` and the produce/repair code
skips `isCenter` cells. No other change to placement.

### `produce.ts`

```ts
for each non-center cell in grid:
  damagePct = (maxHp - hp) / maxHp;
  yieldLost = ceil(rawYield * damagePct);
  effectiveYield = max(0, rawYield - yieldLost);
  // contribute effectiveYield to mats[seat].out as today
```

Spec D16: ceiling on the *loss* side, so even 1 HP off bites
visibly. Confirm with a unit test that an HP-3-of-4 building with a
yield of 4 produces 3 (lose ⌈4 × 0.25⌉ = 1 → keep 3), not 3 (round-
down on the keep side would give the same answer here, but the
ceiling rule comes apart at HP-1-of-3 with yield-3: lose ⌈3 ×
0.667⌉ = 2, keep 1 — vs. floor-on-keep: 3 × 0.333 → keep 1 too;
the readings agree on small numbers but diverge at higher yields).

### `domesticRepair`

```ts
export const domesticRepair: Move<SettlementState> = {
  client: false,
  move: ({ G, ctx, playerID }, { cellKey, amount }) => {
    if (currentDomesticSeat(G, ctx) !== playerID) return INVALID_MOVE;
    const cell = G.domestic.grid[cellKey];
    if (!cell || cell.isCenter) return INVALID_MOVE;
    if (amount <= 0) return INVALID_MOVE;
    const missing = cell.maxHp - cell.hp;
    if (missing <= 0) return INVALID_MOVE;
    const wantedAmount = Math.min(amount, missing);
    const def = BUILDINGS.find(b => b.name === cell.defID);
    if (!def) return INVALID_MOVE;
    const cost = Math.ceil(def.cost * wantedAmount / cell.maxHp);
    const seatStash = G.mats[playerID].stash;
    if (!canPay(seatStash, { gold: cost })) return INVALID_MOVE;
    payFromStash(seatStash, { gold: cost });
    cell.hp += wantedAmount;
  },
};
```

Cost currency: gold by default, matching the way upgrade costs work
today. Open whether some buildings should require non-gold to
repair — defer to content tuning in Phase 2 / playtest.

### Setup

The center tile gets `hp: 99, maxHp: 99` in `setupDomestic` (already
landed in 1.2). Repair / produce skip it.

## Test plan

- Yield prorating:
  - HP 4/4 → full yield.
  - HP 3/4 with yield 4 → effective yield 3.
  - HP 1/4 with yield 4 → effective yield 1.
  - HP 1/3 with yield 3 → effective yield 1.
  - HP 2/2 (max already) → full yield.
- Repair:
  - Pay correct gold for partial repair.
  - INVALID_MOVE if cell is at max HP, doesn't exist, or is the
    center tile.
  - INVALID_MOVE if seat can't afford.
  - Wallet drains and HP rises by the requested amount (capped at
    missing).
- Setup: every non-center building places with `hp = maxHp`.

## Out of scope

- Damage generation. Phase 2's resolver creates the events that
  push HP down; this sub-phase only provides the surface.
- Repair UI. Phase 3 surfaces it visually.
- Non-gold repair costs. Deferred to balance pass.

## Done when

- Buildings carry HP, prorate yield correctly, and can be repaired
  via a single new move.
- All tests pass; no behavior changes for the (still empty) damage
  vector.
