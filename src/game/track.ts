// Defense redesign 2.2 — runtime state for the Global Event Track (D19).
//
// The track is a fixed sequence of cards built once at setup: each phase
// pile (1..10) is shuffled independently, then the piles are concatenated
// in phase order. Index 0 of `upcoming` is the next card to flip; flipped
// cards move to `history` (most-recent-last). The boss card is the unique
// last entry — the loader in `src/data/trackCards.ts` enforces that there
// is exactly one boss card and that it lives in phase 10, so the
// concatenation guarantees it lands at the very end of `upcoming`.
//
// This module ships pure helpers only — no bgio imports. Phase 2.3 wires
// the `chiefFlipTrack` move on top of `advanceTrack`; Phase 2.5's red-tech
// "peek N" effects will read `peekFollowing`. The state shape is
// publicly visible (it's the table-presence telegraph), so `playerView`
// performs no redaction on `G.track`.

import type { TrackCardDef, ModifierCard } from '../data/index.ts';
import type { RandomAPI } from './random.ts';
import { registerRoundEndHook } from './hooks.ts';

export interface TrackState {
  // The full card sequence — built at setup, never re-shuffled.
  // Index 0 is the next card to flip (and the face-up telegraph).
  upcoming: TrackCardDef[];
  // Cards already flipped, most-recent-last.
  history: TrackCardDef[];
  // Cached: current phase index based on `upcoming[0]?.phase`. Stored so
  // the UI doesn't have to recompute every render. When `upcoming` is
  // empty (post-boss) this falls back to the most-recently-flipped card's
  // phase (or 1 if the track was never populated — degenerate but
  // non-throwing).
  currentPhase: number;
  // Defense redesign 2.3 — modifier cards pushed by the resolver when a
  // `kind: 'modifier'` track card flips. Consumed by the resolver at the
  // start of the next threat fire (so a modifier dispatched on round N
  // affects threats flipped later in round N) and cleared at end-of-round
  // (Phase 2.8). Optional so older fixtures stay source-compatible; the
  // resolver lazy-initializes when pushing.
  activeModifiers?: ModifierCard[];
  // Defense redesign 2.3 — per-round latch: `true` after `chiefFlipTrack`
  // resolves. `chiefEndPhase` rejects (INVALID_MOVE) until this is set,
  // forcing the chief to flip the round's track card before transitioning
  // to `othersPhase`. Cleared at every chiefPhase.onBegin (the next round
  // starts with the flag reset). Optional so older fixtures stay
  // source-compatible.
  flippedThisRound?: boolean;
}

/**
 * Build the initial track state from a list of TrackCardDef sourced from
 * `TRACK_CARDS`. Each phase pile is shuffled independently via
 * `random.shuffle` (so two clients with the same bgio seed produce the
 * same track), then piles are concatenated in ascending phase order.
 *
 * The 2.1 loader guarantees:
 *   - exactly one boss card, in phase 10;
 *   - phases 1..10 each have at least one card.
 * Together those mean the boss sits at the very end of `upcoming` after
 * concatenation — Phase 2.7 (boss resolution) relies on that invariant.
 *
 * Edge case: an empty `source` array produces an empty `upcoming`,
 * `currentPhase = 1`. Callers should never hit this in production
 * (TRACK_CARDS is non-empty by loader contract); the branch exists so
 * unit tests can exercise the degenerate path without throwing.
 */
export const buildTrack = (
  random: RandomAPI,
  source: ReadonlyArray<TrackCardDef>,
): TrackState => {
  // Group by phase. We avoid mutating `source` (the loader deep-freezes
  // every entry) by accumulating into fresh arrays.
  const byPhase = new Map<number, TrackCardDef[]>();
  for (const card of source) {
    const arr = byPhase.get(card.phase) ?? [];
    arr.push(card);
    byPhase.set(card.phase, arr);
  }
  // Shuffle each pile independently, then concatenate in ascending phase
  // order. The boss is the only phase-10 card (per loader invariant), so
  // it ends up last.
  const upcoming: TrackCardDef[] = [];
  const phases = [...byPhase.keys()].sort((a, b) => a - b);
  for (const phase of phases) {
    const pile = byPhase.get(phase)!;
    upcoming.push(...random.shuffle(pile));
  }
  return {
    upcoming,
    history: [],
    currentPhase: upcoming[0]?.phase ?? 1,
  };
};

/**
 * The next card to flip — the face-up telegraph the table sees before
 * the chief flips it. Returns `undefined` once the track is exhausted
 * (post-boss; should not happen in a normal game).
 */
export const peekNext = (t: TrackState): TrackCardDef | undefined =>
  t.upcoming[0];

/**
 * The next `n` upcoming cards (clamped to the available length). Used by
 * Phase 2.5's red-tech "peek next N" effects. Negative or zero `n`
 * produces an empty array rather than throwing — the caller is the
 * effect dispatcher and a bad amount upstream shouldn't crash render.
 */
export const peekFollowing = (
  t: TrackState,
  n: number,
): TrackCardDef[] => t.upcoming.slice(0, Math.max(0, n));

/**
 * Pop the next card off `upcoming`, push it onto `history`, and refresh
 * `currentPhase`. Returns the card that was advanced (so the resolve
 * algorithm in Phase 2.3 can route it through the threat / boon /
 * modifier dispatcher). Returns `undefined` when there's nothing left
 * to advance.
 *
 * Pure mutation against the passed `TrackState` — boardgame.io wraps
 * moves in Immer, so direct mutation is the idiomatic style. The caller
 * is responsible for invoking this from a move (or a setup helper).
 */
export const advanceTrack = (
  t: TrackState,
): TrackCardDef | undefined => {
  const next = t.upcoming.shift();
  if (next === undefined) return undefined;
  t.history.push(next);
  // After advancing, the new "current phase" is whatever the *new* next
  // card is. If `upcoming` is now empty (we just advanced the boss),
  // hold the phase at the just-advanced card's phase rather than
  // resetting to 1 — keeps UI labels sensible during the brief boss-
  // resolution window before `endIf` fires.
  t.currentPhase = t.upcoming[0]?.phase ?? next.phase;
  return next;
};

// Defense redesign 2.4 — round-end hook: clear the per-round
// `flippedThisRound` latch so the next round's `chiefPhase` starts with
// the chief required to flip again (D22). Registered at module load
// (idempotent under the hooks-registry contract). Tests that need a
// clean slate must call `__resetHooksForTest()` and then re-import
// this module.
//
// Note: `chiefPhase.onBegin` also resets `flippedThisRound` defensively
// at the top of every chief turn. The round-end clear is the canonical
// reset point in the per-feature ownership model (each module owns its
// per-round state), and it runs before `chiefPhase` so the chief never
// sees a stale `true` from the previous round.
registerRoundEndHook('track:reset-flipped-this-round', (G) => {
  if (G.track === undefined) return;
  G.track.flippedThisRound = false;
});
