# Sub-phase 2.1 — Track schema and content loader

**Parent:** [phase-2](./defense-redesign-phase-2.md)
**Spec refs:** D19, D20, D21 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** All of Phase 1 merged.

## Goal

Define the JSON schema for global event track cards, write a
typed loader, ship a placeholder `trackCards.json` covering all 10
phases, and expose a `TRACK_CARDS` constant alongside existing
`BUILDINGS` / `UNITS` etc.

After 2.1, the data path is ready. State + resolver land in 2.2 +
2.3.

## Files touched

- `src/data/schema.ts` — `TrackCardDef` discriminated union.
- `src/data/trackCards.json` (new) — placeholder content, all 10
  phases populated with at least the minimum 3 cards each.
- `src/data/trackCards.ts` (new) — typed loader, mirroring
  `units.ts` / `buildings.ts`.
- `src/data/index.ts` — re-export `TRACK_CARDS`.
- `tests/data/trackCards.spec.ts` (new) — schema validity, phase
  coverage, boss exists exactly once.

## `TrackCardDef`

```ts
export type Direction = 'N' | 'E' | 'S' | 'W';

export interface TrackCardBase {
  id: string;             // unique
  name: string;           // human-readable
  phase: number;          // 1..10
  description: string;    // flavour + rules text the table reads
}

export interface ThreatCard extends TrackCardBase {
  kind: 'threat';
  direction: Direction;
  offset: number;         // signed offset from center on the
                          // perpendicular axis. Threats from N or S
                          // walk down a column at offset (x = offset);
                          // threats from E or W walk along a row at
                          // offset (y = offset).
  strength: number;       // both HP and damage (D7)
  reward?: ResourceBag;   // optional bank reward when killed
  modifiers?: string[];   // free-text matchup tags read by resolver
                          // (e.g. "Cavalry", "Flier") — D10
}

export interface BoonCard extends TrackCardBase {
  kind: 'boon';
  effect: BoonEffect;     // dispatched through the existing event
                          // effect system
}

export interface ModifierCard extends TrackCardBase {
  kind: 'modifier';
  durationRounds: number; // typically 1
  effect: ModifierEffect; // pushed onto a one-round modifier stack
}

export interface BossCard extends TrackCardBase {
  kind: 'boss';
  thresholds: {
    science: number;      // completed science card count
    economy: number;      // bank gold
    military: number;     // sum of unit.strength on grid
  };
  baseAttacks: number;    // attacks made if no thresholds met
  attackPattern: ThreatPattern[]; // sequence of strengths +
                                  // directions for each attack
}

export type TrackCardDef =
  | ThreatCard
  | BoonCard
  | ModifierCard
  | BossCard;
```

`BoonEffect` and `ModifierEffect` reuse the existing `EventEffect`
taxonomy from `src/game/events/`. Phase 2.3 / 2.8 wire dispatch.

## `trackCards.json`

Placeholder content for all 10 phases:

- Phase 1: 3 cards (1 threat strength 2, 1 boon, 1 modifier).
- Phases 2–9: 3–4 cards each, with strength climbing roughly linear:
  phase N threats ≈ strength `N + 1` for the soft tier and
  `N + 2` / `N + 3` for the harder tier within phase N.
- Phase 10: 1 boss card. `baseAttacks: 4`. Thresholds tuned later
  in playtest.

The placeholder values are *not* balanced — they exist so the
resolver in 2.3 has something to chew. Balance pass comes after
Phase 2 lands end-to-end.

## Loader

`trackCards.ts` does the same thing as `battleCards.ts` did
pre-1.4: parses, validates, exports a frozen array.

```ts
import raw from './trackCards.json' assert { type: 'json' };
import type { TrackCardDef } from './schema.ts';
const validate = (rs: unknown[]): TrackCardDef[] => { /* runtime */ };
export const TRACK_CARDS: ReadonlyArray<TrackCardDef> = Object.freeze(validate(raw));
```

Validate at module load:

- All phases 1..10 present.
- Exactly one card with `kind: 'boss'`, in phase 10.
- All threat cards have `direction in {N, E, S, W}`,
  `Number.isInteger(offset)`, `strength >= 1`.
- No duplicate `id`s.

## Tests

- Loader: parse trackCards.json without throwing; freeze the array.
- Schema: every card has its discriminator-required fields.
- Phase coverage: each of phases 1–10 has at least one card.
- Boss uniqueness: exactly one boss, in phase 10.
- Thresholds: boss thresholds are non-negative integers.

## Out of scope

- Setting up `G.track` state (2.2).
- Track manipulation moves (2.5 — tech effects).
- Drawing / flipping any card (2.3).
- Boss resolution (2.7).

## Done when

- `TRACK_CARDS` is importable from `src/data/index.ts`.
- A `Track Card Schema` test suite passes covering schema +
  validity invariants.
- `npm run typecheck`, `npm run lint`, `npm test` pass.
- Phase 2.2 can read `TRACK_CARDS` without further plumbing.
