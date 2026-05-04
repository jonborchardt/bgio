// Defense redesign 2.3 — `chiefFlipTrack` move.
//
// The Chief flips the next card on the Global Event Track. Resolution
// runs immediately inside the move via `resolveTrackCard`. Per spec D22
// the flip happens after the chief's other actions but **before**
// `chiefEndPhase`; we enforce that by setting `G.track.flippedThisRound`
// on success and by rejecting `chiefEndPhase` until the latch is set.
//
// Validations (in order):
//   1. caller has a defined playerID
//   2. caller holds the `chief` role (only chief may flip)
//   3. engine is in `chiefPhase`
//   4. `G.track` exists and `upcoming` has at least one card
//   5. flip hasn't already happened this round
//
// On success: clear any pending undo (the resolver mutates shared state
// in many places), advance the track via `advanceTrack`, set the
// `flippedThisRound` latch, dispatch the card through `resolveTrackCard`.
//
// `random` is taken from bgio's plugin and wrapped via `fromBgio`. A
// missing `random` (some headless test paths) falls through a small
// identity stub so the move stays callable from synthetic state.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { fromBgio, type BgioRandomLike } from '../../random.ts';
import { advanceTrack } from '../../track.ts';
import { resolveTrackCard } from '../../track/resolver.ts';
import { clearUndoable } from '../../undo.ts';

export const chiefFlipTrack: Move<SettlementState> = (
  { G, ctx, playerID, random },
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('chief')) {
    return INVALID_MOVE;
  }
  if (ctx.phase !== 'chiefPhase') return INVALID_MOVE;
  if (G.track === undefined) return INVALID_MOVE;
  if (G.track.upcoming.length === 0) return INVALID_MOVE;
  if (G.track.flippedThisRound === true) return INVALID_MOVE;

  // The resolver mutates wide swaths of G — bank, mats, defense.inPlay,
  // domestic.grid hp, modifier stack. None of that is cleanly undoable
  // through the single-slot snapshot, so we wipe the undo before
  // advancing.
  clearUndoable(G);

  const card = advanceTrack(G.track);
  if (card === undefined) return INVALID_MOVE; // defensive (length checked above)

  // Set the latch *before* dispatch so resolver-internal modifications
  // observed by tests are consistent with "this round's flip happened."
  G.track.flippedThisRound = true;

  // Wrap bgio's random plugin. Headless dispatcher tests may run without
  // a real random plugin attached; the identity stub keeps the resolver
  // deterministic in that case.
  const fallbackRandom: BgioRandomLike = {
    Shuffle: <T>(arr: T[]): T[] => [...arr],
    Number: () => 0,
  };
  const r = fromBgio((random as BgioRandomLike | undefined) ?? fallbackRandom);

  resolveTrackCard(G, r, card);
};
