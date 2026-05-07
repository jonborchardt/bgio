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
import type { ResourceBag } from './resources/types.ts';
import type { RandomAPI } from './random.ts';
import { registerRoundEndHook } from './hooks.ts';

// Defense redesign 3.3 — per-resolve playback trace.
//
// Every time a track card flips and `resolveTrackCard` runs, the resolver
// fills out a `ResolveTrace` summarizing what just happened: the path the
// threat walked, which units fired (by id), which tiles took damage in
// what order, whether the center vault was burned, and an outcome label
// the UI uses to decide which animation to play. Boons / modifiers also
// emit a (degenerate) trace with `outcome: 'noop'` so the playback layer
// can blink the strip even for a non-combat flip.
//
// The trace is parallel-indexed against `history`: `traces[i]` describes
// the resolution of `history[i]`. `lastResolve` is a convenience handle on
// the most recently appended trace — the UI watches that field's identity
// to detect "a new flip just resolved" without comparing array lengths.
// Boss attacks (each one is a synthetic threat) push a trace per attack,
// not per boss card, so the path overlay can animate the multi-attack
// sequence one path at a time.
export interface ResolveTrace {
  /** Cells the threat walked, in path order. Empty for boons / modifiers. */
  pathTiles: ReadonlyArray<{ x: number; y: number }>;
  /** UnitInstance.id values that opened fire. Stable across renders so the
   *  UI can highlight the firing units' tiles distinctly from the path. */
  firingUnitIDs: string[];
  /** cellKey strings for tiles the threat damaged in path order (the
   *  building / unit-stack absorption sites). Excludes the entry / pass-
   *  through cells. */
  impactTiles: string[];
  /** Total resources burned from the center pool (sum across resources).
   *  `undefined` when the threat did not reach center. */
  centerBurned?: number;
  /** Defense redesign 3.4 — per-resource breakdown of what the center
   *  burn actually consumed. Parallel to `centerBurned` (sum equals
   *  `centerBurned`); the banner reads this to render its
   *  "−3 wood, −1 stone" line without re-deriving from `bankLog`. Only
   *  populated when `centerBurned > 0`; otherwise undefined. */
  centerBurnDetail?: Partial<ResourceBag>;
  /** Defense redesign 3.4 — name of the threat / boss-attack card that
   *  caused the burn. Surfaces in the banner's second line ("to ⚔ Cyclone
   *  | round 14") for audit traceability. Only populated when
   *  `centerBurned > 0`. */
  centerBurnSource?: string;
  /** Defense redesign 3.4 — round number at which the burn happened.
   *  Lifted off `G.round` at resolve time so the banner can show the
   *  round even if it renders after the round counter advances. Only
   *  populated when `centerBurned > 0`. */
  centerBurnRound?: number;
  /** What the trace reads as for the playback layer:
   *   - `killed`         : threat died to fire before reaching impact.
   *   - `overflowed`     : threat damaged 1+ buildings, then either died or
   *                        reached center.
   *   - `reachedCenter`  : threat crossed the village without enough push-
   *                        back and burned the pool.
   *   - `noop`           : non-threat card (boon / modifier) — the strip
   *                        blinks but no path animation runs. */
  outcome: 'killed' | 'overflowed' | 'reachedCenter' | 'noop';
}

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
  // Defense redesign 3.3 — playback traces, one per resolve volley
  // (parallel-indexed against the boss's expanded attack list, so a single
  // boss flip produces multiple traces). Optional so older fixtures stay
  // source-compatible; the resolver lazy-initializes on first append.
  traces?: ResolveTrace[];
  // Defense redesign 3.3 — convenience handle on the most-recently-
  // appended trace. The UI's animation context watches this slot's
  // identity to detect "a new flip just resolved" without diffing the
  // `traces[]` length. Optional for the same reason as `traces`.
  lastResolve?: ResolveTrace;
}

/** ID of the deterministic first card the chief flips on round 1. The
 *  card lives in `trackCards.json` like any other (kind: boon, phase 1)
 *  but is **not** shuffled into the phase-1 pile — `buildTrack` lifts it
 *  out and prepends it so every match opens with the same telegraphed
 *  beat ("A New Dawn — chief gains 1 gold"). The user requested this
 *  pinning post-3.9 so the table has a predictable first turn instead
 *  of a randomly-drawn threat or boon. */
export const FIRST_TRACK_CARD_ID = 'trk-p1-first-dawn';

/**
 * Build the initial track state from a list of TrackCardDef sourced from
 * `TRACK_CARDS`. Each phase pile is shuffled independently via
 * `random.shuffle` (so two clients with the same bgio seed produce the
 * same track), then piles are concatenated in ascending phase order.
 *
 * The card with id `FIRST_TRACK_CARD_ID` is pinned to slot 0 — it's
 * lifted out of its phase pile before that pile shuffles, then prepended
 * to `upcoming`. If the source array doesn't contain that id (older
 * fixtures, test factories) the pin is a no-op and the normal shuffle
 * order applies.
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
  // Lift the pinned-first card out before grouping so it doesn't get
  // shuffled into its phase pile. Missing pin (e.g. test factories that
  // pass a custom card list) is a no-op.
  const pinned = source.find((c) => c.id === FIRST_TRACK_CARD_ID);
  const rest = pinned !== undefined
    ? source.filter((c) => c.id !== FIRST_TRACK_CARD_ID)
    : source;

  // Group the remainder by phase. We avoid mutating `source` (the
  // loader deep-freezes every entry) by accumulating into fresh arrays.
  const byPhase = new Map<number, TrackCardDef[]>();
  for (const card of rest) {
    const arr = byPhase.get(card.phase) ?? [];
    arr.push(card);
    byPhase.set(card.phase, arr);
  }
  // Shuffle each pile independently, then concatenate in ascending phase
  // order. The boss is the only phase-10 card (per loader invariant), so
  // it ends up last.
  const upcoming: TrackCardDef[] = [];
  if (pinned !== undefined) upcoming.push(pinned);
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
