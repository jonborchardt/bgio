// chiefTax — chief super-power, once per round.
//
// The Chief levies a tax on every non-chief seat's stash. For each of
// the 10 resource types `r`, every non-chief seat loses `floor(stash[r] / 2)`
// to the levy. The levy is then split per resource: the bank gains
// `ceil(taken[r] / 2)` and the remainder evaporates. The evaporation is
// the cost of using the move — small hauls barely lose (take 1 → bank
// gets 1, lose 0), big hauls bleed (take 7 → bank gets 4, lose 3). That
// shape punishes hoarding more than steady spending.
//
// Validations (in order):
//   1. caller has a defined playerID,
//   2. caller holds the `chief` role,
//   3. engine is in `chiefPhase`,
//   4. once-per-round latch (`G.chief.taxedThisRound`) is unset.
//
// On success: walk every non-chief mat, drain `floor(half)` from each
// stash slot, accumulate per-resource take, push `ceil(half_of_take)`
// into the bank via `appendBankLog` (so `economyHigh` stays in sync with
// every other bank-touching path), and set the latch. The remainder
// (the evaporated half) is intentionally not logged as a separate
// bankLog entry — it isn't a bank mutation, it's just resources that
// stop existing.
//
// The latch is set whether or not the haul was non-zero. A chief who
// taxes an empty room loses the round's slot — match the "drastic" feel
// of the move and avoid an "oops, no take, free retry" loophole.
// Round-end clearing of `taxedThisRound` is owned by the
// `chief:reset-tax` hook registered below.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import type { Resource, ResourceBag } from '../../resources/types.ts';
import { RESOURCES } from '../../resources/types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { appendBankLog } from '../../resources/bankLog.ts';
import { clearUndoable } from '../../undo.ts';
import { registerRoundEndHook } from '../../hooks.ts';

export const chiefTax: Move<SettlementState> = ({ G, ctx, playerID }) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('chief')) {
    return INVALID_MOVE;
  }
  if (ctx.phase !== 'chiefPhase') return INVALID_MOVE;
  if (G.chief?.taxedThisRound === true) return INVALID_MOVE;

  // The move mutates many seats' stashes plus the bank — no clean way
  // to roll that back through the single-slot undo, so wipe it.
  clearUndoable(G);

  // Walk every non-chief mat, drain floor(half) per resource, tally.
  const taken: Partial<ResourceBag> = {};
  for (const [seat, mat] of Object.entries(G.mats ?? {})) {
    if (mat === undefined) continue;
    if (rolesAtSeat(G.roleAssignments, seat).includes('chief')) continue;
    for (const r of RESOURCES as ReadonlyArray<Resource>) {
      const have = mat.stash[r] ?? 0;
      if (have <= 1) continue;
      const t = Math.floor(have / 2);
      mat.stash[r] = have - t;
      taken[r] = (taken[r] ?? 0) + t;
    }
  }

  // Bank gains ceil(taken / 2) per resource; the remainder evaporates.
  const bankGain: Partial<ResourceBag> = {};
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const t = taken[r] ?? 0;
    if (t <= 0) continue;
    const gain = Math.ceil(t / 2);
    bankGain[r] = gain;
    G.bank[r] = (G.bank[r] ?? 0) + gain;
  }

  // Audit-trail entry — `appendBankLog` skips empty deltas, so an
  // empty-room tax silently logs nothing. The detail string keeps the
  // chief tooltip narratable without leaking per-seat amounts (those
  // aren't bank events).
  appendBankLog(G, 'tax', bankGain, 'Chief tax');

  if (G.chief !== undefined) {
    G.chief.taxedThisRound = true;
  }
};

// Round-end hook: clear the per-round latch so the next chief phase
// can tax again. Module-load registration follows the same pattern as
// `roles/science/drill.ts`'s `science:reset-defense-moves` hook.
registerRoundEndHook('chief:reset-tax', (G) => {
  if (G.chief === undefined) return;
  G.chief.taxedThisRound = false;
});
