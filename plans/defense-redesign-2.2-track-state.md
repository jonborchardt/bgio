# Sub-phase 2.2 — Track state on G + setup

**Parent:** [phase-2](./defense-redesign-phase-2.md)
**Spec refs:** D19 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 2.1 merged.

## Goal

Add the track's runtime state to `G`, build the deck at setup-time
(10 phase piles, each shuffled), and expose a deterministic next /
current view. This sub-phase produces no behavior beyond setup and
inspection — Phase 2.3 wires the flip move and resolver.

## Files touched

- `src/game/types.ts` — add `TrackState` to `SettlementState`.
- `src/game/setup.ts` — build the track from `TRACK_CARDS` using
  `RandomAPI.shuffle`.
- `src/game/track.ts` (new) — pure helpers (build, peek, advance).
- `tests/game/track.spec.ts` (new) — coverage.
- `src/game/playerView.ts` — make sure `G.track` is fully visible
  to all players (it's public table information).

## State shape

```ts
interface TrackState {
  // The full card sequence — built at setup, never re-shuffled.
  // Index 0 is the next card to flip.
  upcoming: TrackCardDef[];
  // Cards already flipped, most-recent-last.
  history: TrackCardDef[];
  // Cached: current phase index based on upcoming[0]?.phase.
  // Stored so UI doesn't recompute every render.
  currentPhase: number;
}
```

`SettlementState`:

```ts
interface SettlementState {
  // ...existing
  track: TrackState;
}
```

## Setup

```ts
// src/game/setup.ts
import { TRACK_CARDS } from '../data/index.ts';
import { buildTrack } from './track.ts';

// inside setup(ctx, setupData):
G.track = buildTrack(random, TRACK_CARDS);
```

```ts
// src/game/track.ts
export const buildTrack = (
  random: RandomAPI,
  source: ReadonlyArray<TrackCardDef>,
): TrackState => {
  // Group by phase.
  const byPhase = new Map<number, TrackCardDef[]>();
  for (const c of source) {
    const arr = byPhase.get(c.phase) ?? [];
    arr.push(c);
    byPhase.set(c.phase, arr);
  }
  // Shuffle each phase pile independently, concatenate in order.
  const upcoming: TrackCardDef[] = [];
  const phases = [...byPhase.keys()].sort((a, b) => a - b);
  for (const p of phases) {
    const pile = byPhase.get(p)!;
    upcoming.push(...random.shuffle(pile));
  }
  return {
    upcoming,
    history: [],
    currentPhase: upcoming[0]?.phase ?? 1,
  };
};
```

The boss is in phase 10's pile (singleton). After concatenation,
the boss sits at the very end — guaranteed by 2.1's validator
constraints.

## Helpers

```ts
export const peekNext = (t: TrackState): TrackCardDef | undefined =>
  t.upcoming[0];

export const peekFollowing = (t: TrackState, n: number): TrackCardDef[] =>
  t.upcoming.slice(0, Math.max(0, n));

// Used by 2.3 — does NOT resolve. Just moves the card.
export const advanceTrack = (t: TrackState): TrackCardDef | undefined => {
  const next = t.upcoming.shift();
  if (next === undefined) return undefined;
  t.history.push(next);
  t.currentPhase = t.upcoming[0]?.phase ?? next.phase;
  return next;
};
```

`peekFollowing` supports the Forewarn alternative we did NOT take —
keep it anyway because red tech "peek N" effects in 2.5 will use it.

## Player view

```ts
// src/game/playerView.ts
// G.track is public information — no redaction.
```

## Tests

- `buildTrack` produces an upcoming list whose phases are
  monotonically non-decreasing.
- The boss card is the last entry of `upcoming`.
- `peekNext` returns the first card; `advanceTrack` mutates state
  correctly.
- Setup with a real seed produces a stable track for the same
  seed (determinism contract).
- Empty `TRACK_CARDS` produces empty `upcoming`, `currentPhase = 1`
  (degenerate but should not throw).

## Out of scope

- Flipping cards (2.3).
- Resolving any card's effect (2.3 + 2.8).
- UI of the track (Phase 3).
- Track-modifier tech effects (2.5).

## Done when

- `G.track` is populated at setup.
- Helpers work and are tested.
- Phase 2.3 can write `chiefFlipTrack` against the helpers without
  state-shape adjustments.
