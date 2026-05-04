// Per-seat player mat — `in`, `out`, `stash` resource bags.
//
// Replaces the older `wallet` + `centerMat.circles` split. Every non-chief
// seat owns one PlayerMat. Public reads are fine — there's no secret
// resource state — the three slots just visualize where tokens are in
// the round's flow:
//
//   - `in`    : tokens the chief just dropped here for this seat. Drained
//               into `stash` automatically when the seat begins its turn.
//   - `out`   : tokens this seat produced this round. The chief sweeps
//               every seat's `out` into the bank at the start of their
//               next turn.
//   - `stash` : the seat's working pool. Spend moves (Science contribute,
//               Domestic buy / upgrade / repair, and the Phase 2 Defense
//               buy/place + Science Drill/Teach moves) all draw from here.
//
// All mutating helpers run under Immer (called from inside boardgame.io
// moves or `phase.turn.onBegin`), so they mutate `mat` directly.

import type { PlayerID, Role } from '../types.ts';
import type { ResourceBag } from './types.ts';
import { RESOURCES } from './types.ts';
import { bagOf } from './bag.ts';

export interface PlayerMat {
  in: ResourceBag;
  out: ResourceBag;
  stash: ResourceBag;
}

// Builds one PlayerMat per non-chief seat. A seat is "non-chief" iff it
// does NOT hold the `chief` role. The chief acts on `G.bank` directly
// and owns no mat entry — accidental `mats[chiefSeat]` lookups surface
// as `undefined` rather than spending from a phantom bag.
export const initialMats = (
  assignments: Record<PlayerID, Role[]>,
): Record<PlayerID, PlayerMat> => {
  const mats: Record<PlayerID, PlayerMat> = {};
  for (const [seat, roles] of Object.entries(assignments)) {
    if (!roles.includes('chief')) {
      mats[seat] = {
        in: bagOf({}),
        out: bagOf({}),
        stash: bagOf({}),
      };
    }
  }
  return mats;
};

const addInto = (
  bag: ResourceBag,
  amounts: Partial<ResourceBag>,
): void => {
  for (const r of RESOURCES) {
    const amt = amounts[r] ?? 0;
    if (amt === 0) continue;
    if (amt < 0) {
      throw new RangeError(
        `addInto: negative amount for ${r} (${amt})`,
      );
    }
    bag[r] += amt;
  }
};

// Drain `from` completely and return the moved amounts as a partial bag
// (only non-zero entries). Used by the chief's sweep and by takeIn.
export const drainBag = (
  from: ResourceBag,
): Partial<ResourceBag> => {
  const moved: Partial<ResourceBag> = {};
  for (const r of RESOURCES) {
    const amt = from[r];
    if (amt > 0) {
      moved[r] = amt;
      from[r] = 0;
    }
  }
  return moved;
};

// Drop `amounts` into `mat.in` (chief distribution destination).
export const placeIntoIn = (
  mat: PlayerMat,
  amounts: Partial<ResourceBag>,
): void => {
  addInto(mat.in, amounts);
};

// Drop `amounts` into `mat.out` (production destination).
export const placeIntoOut = (
  mat: PlayerMat,
  amounts: Partial<ResourceBag>,
): void => {
  addInto(mat.out, amounts);
};

// Move every non-zero `in` entry into `stash`. Returns the moved bag for
// callers that want to log or surface the transfer.
export const takeIntoStash = (mat: PlayerMat): Partial<ResourceBag> => {
  const moved = drainBag(mat.in);
  for (const r of RESOURCES) {
    const amt = moved[r] ?? 0;
    if (amt > 0) mat.stash[r] += amt;
  }
  return moved;
};
