# Sub-phase 1.1 — Content schema extensions

**Parent:** [phase-1](./defense-redesign-phase-1.md)
**Spec refs:** D9, D11, D15, D18, D27 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)

## Goal

Land the new schema fields on `BuildingDef`, `UnitDef`, and add a
new `SkillDef` table — without changing any runtime behaviour yet.
Existing tests pass; new fields default to safe values.

## Files touched

- `src/data/schema.ts` — add fields.
- `src/data/buildings.json` — add `maxHp` per building.
- `src/data/units.json` — add `range`, `regen`, `hp` (renamed from
  `defense`), `firstStrike`, `placementBonus`.
- `src/game/roles/science/skills.ts` (new) — `SKILLS` content
  table.
- `src/data/index.ts` — export the new content table; ensure
  loaders pass through the new fields.
- `tests/data/schema.spec.ts` (or equivalent) — round-trip the
  expanded JSON.

## Concrete changes

### `BuildingDef`

```ts
interface BuildingDef {
  // ...existing
  maxHp: number;            // 1..4, per spec D15
}
```

JSON migration: every building in `buildings.json` gains
`"maxHp": <int>`. Defaults: a starter shack = 1, mid-tier = 2,
fortifications = 3, Walls / heavy Tower = 4. Rough mapping by cost
in the absence of playtest data, but **do not** lock cost = HP
(spec D15 explicitly says "tied to cost, not 1:1").

### `UnitDef`

```ts
interface UnitDef {
  // ...existing
  hp: number;               // renamed from `defense` — clarity.
                            // Pure rename. defense → hp.
  range: number;            // Chebyshev radius. Default 1.
  regen: number;            // HP regenerated per round. Default 0.
  firstStrike: boolean;     // Default false.
  placementBonus?: PlacementBonus[];  // D18.
}

interface PlacementBonus {
  buildingDefID: string;    // matches BuildingDef.name
  effect: PlacementEffect;
}

type PlacementEffect =
  | { kind: 'strength'; amount: number }
  | { kind: 'range'; amount: number }
  | { kind: 'regen'; amount: number }
  | { kind: 'hp'; amount: number }
  | { kind: 'firstStrike' };
```

JSON migration: every unit gains the new fields. `defense` → `hp`
is a pure rename (shows up in `battleResolver.ts`, but that file is
deleted in 1.4 anyway — the rename here is purely for clarity in
the persisted JSON before the resolver is removed). Most units get
`range: 1`, `regen: 0`, `firstStrike: false`, `placementBonus: []`
unless content explicitly differentiates them. The discriminated-
union `PlacementEffect` keeps the resolver's switch exhaustive.

### `SkillDef` table (new)

```ts
// src/game/roles/science/skills.ts
export type SkillID =
  | 'extendRange'
  | 'reinforce'
  | 'accelerate'
  | 'sharpen'
  | 'firstStrike';

export interface SkillDef {
  id: SkillID;
  name: string;          // human-readable
  description: string;
  cost: number;          // science cost from stash
  effect: PlacementEffect; // reuses the same effect taxonomy
}

export const SKILLS: Readonly<Record<SkillID, SkillDef>> = { ... };
```

Reusing `PlacementEffect` for skill effects keeps a single effect
applier for placement bonuses *and* taught skills. `extendRange` is
just `{ kind: 'range', amount: 1 }` — same plumbing.

## Test plan

- `tests/data/schema.spec.ts`: parse `buildings.json` and
  `units.json` after migration; assert every entry has the new
  fields and all `placementBonus.buildingDefID` strings refer to
  buildings that exist.
- `tests/game/roles/science/skills.spec.ts` (new, tiny): assert
  every `SkillID` has a `SkillDef`, all costs > 0, no duplicate
  names.

## Out of scope

- Reading any of the new fields at runtime. The combat resolver
  and production code don't change here. (1.3 reads `maxHp`. Phase
  2 reads the rest.)

## Done when

- `npm run typecheck`, `npm run lint`, `npm test` all pass with the
  expanded JSON and new types.
- No behaviour change in the running game — same setup, same
  moves, same outputs.
