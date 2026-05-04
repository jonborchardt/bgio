// Defense redesign 3.8 — pure logic helpers for the chief seat's
// Flip Track + End-my-phase controls.
//
// Mirrors the pattern in `src/ui/science/drillTeachLogic.ts`: keeping
// the disabled / status branches in a non-component module
//
//   1. lets the ChiefPanel sub-components stay one-thing-each (the
//      `react-refresh/only-export-components` lint rule), and
//   2. lets tests pin each branch with a single-input change without
//      spinning a full render tree.
//
// All helpers are deterministic and side-effect free. The strings they
// return are the exact tooltips / inline-error captions surfaced in the
// UI, so a test that asserts on the string also documents the user-
// visible copy.

export interface FlipTrackDisabledArgs {
  /** True only during `chiefPhase`. Outside the chief phase the button
   *  is disabled (the move would INVALID_MOVE anyway). */
  canAct: boolean;
  /** `G.track.flippedThisRound`. Once set, a second flip in the same
   *  round is rejected by the move (D22). */
  flipped: boolean;
  /** Number of cards remaining face-down in the upcoming pile. When 0
   *  there is nothing left to flip — usually means the boss already
   *  resolved in a prior round. */
  upcomingCount: number;
}

/**
 * Returns the reason the Flip Track button should be disabled, or
 * `null` when the button is enabled. Branch order matters — the most
 * actionable reason wins (turn / latch / track-empty).
 */
export const flipTrackDisabledReason = (
  args: FlipTrackDisabledArgs,
): string | null => {
  if (!args.canAct) return 'Flip is only available during your phase.';
  if (args.flipped) return 'Already flipped this round.';
  if (args.upcomingCount <= 0) {
    return 'Track is exhausted — nothing left to flip.';
  }
  return null;
};

export interface ChiefEndPhaseDisabledArgs {
  /** True only during `chiefPhase`. */
  canAct: boolean;
  /** `G.track.flippedThisRound`. The chief must flip the round's track
   *  card before transitioning to othersPhase (D22 / 04.2 gate). */
  flipped: boolean;
  /** Whether the engine has a `track` slot at all. Older fixtures
   *  pre-date 2.2 and don't carry a track; in that case `chiefEndPhase`
   *  skips the flip gate entirely (see `endPhase.ts`). */
  hasTrack: boolean;
}

/**
 * Returns the reason the End-my-phase button should be disabled, or
 * `null` when the button is enabled. The flip-first gate (D22) is the
 * common reason this button is disabled even after distribution work
 * finishes — the gate string drives both the tooltip and the inline
 * error caption surfaced when the chief tries to end the phase too
 * early.
 */
export const chiefEndPhaseDisabledReason = (
  args: ChiefEndPhaseDisabledArgs,
): string | null => {
  if (!args.canAct) return 'End is only available during your phase.';
  if (args.hasTrack && !args.flipped) {
    return 'Flip the track card before ending your phase.';
  }
  return null;
};
