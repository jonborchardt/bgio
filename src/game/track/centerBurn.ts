// Defense redesign 2.3 — center-tile pool burn.
//
// When a threat reaches the village vault (the center tile at `(0, 0)`)
// with leftover strength `S > 0`, `S` resources are taken from the
// **logical pool** of every non-chief seat's `stash`. The math is
// "random but even split":
//
//   for i = 1..S:
//     pick a non-chief seat (uniform from those with stash > 0)
//     pick a resource type (uniform from that seat's stash with > 0)
//     decrement by 1
//
// Spreads damage roughly evenly while staying random over types and
// seats. The chief seat owns no mat and is excluded.
//
// A burn is summarized into a single `centerBurn` entry on `G.bankLog`
// so the chief tooltip's audit trail can narrate "round 14: 3 stone +
// 1 wood burned to a Cyclone." The bank itself is *not* mutated — the
// entry's signed delta is for the audit story only.
//
// Returns the actual amount burned (clamped at the pool's total). When
// the pool is empty, no tokens move and no log entry is emitted.

import type { SettlementState } from '../types.ts';
import type { Resource, ResourceBag } from '../resources/types.ts';
import { RESOURCES } from '../resources/types.ts';
import type { RandomAPI } from '../random.ts';
import { rolesAtSeat } from '../roles.ts';
import { appendBankLog } from '../resources/bankLog.ts';

/**
 * Burn up to `requested` resource tokens from the logical pool of every
 * non-chief seat's stash. Returns the bag of what was actually burned
 * (one entry per resource that was hit; values are positive integers).
 *
 * Mutates `G.mats[seat].stash` in place for each seat that lost tokens
 * and appends a single `centerBurn` log entry on `G.bankLog`. Empty pool
 * → no-op (no log, return value is an empty bag).
 *
 * `detail` is an optional human-readable label (e.g. the threat card's
 * name) for the bank-log entry — wired to whatever the resolver knows
 * about the offender.
 */
export const centerBurn = (
  G: SettlementState,
  random: RandomAPI,
  requested: number,
  detail?: string,
): Partial<ResourceBag> => {
  if (!Number.isFinite(requested) || requested <= 0) return {};

  const burned: Partial<ResourceBag> = {};

  // Identify non-chief seats with mats. The chief seat has no entry in
  // `G.mats`, so iterating `Object.keys(G.mats)` already excludes it,
  // but we double-check via roleAssignments to stay defensive against
  // future shape changes.
  const candidateSeats = (): string[] => {
    const seats: string[] = [];
    for (const seat of Object.keys(G.mats)) {
      if (rolesAtSeat(G.roleAssignments, seat).includes('chief')) continue;
      const mat = G.mats[seat];
      if (mat === undefined) continue;
      // Only seats with at least one resource > 0 in their stash.
      let any = false;
      for (const r of RESOURCES) {
        if (mat.stash[r] > 0) {
          any = true;
          break;
        }
      }
      if (any) seats.push(seat);
    }
    return seats;
  };

  let remaining = Math.floor(requested);
  while (remaining > 0) {
    const seats = candidateSeats();
    if (seats.length === 0) break; // pool empty
    const seat = random.pickOne(seats);
    const mat = G.mats[seat];
    if (mat === undefined) break; // defensive — should not happen
    // Build the list of non-zero resource types in this seat's stash.
    const types: Resource[] = [];
    for (const r of RESOURCES) {
      if (mat.stash[r] > 0) types.push(r);
    }
    if (types.length === 0) break; // defensive — candidateSeats filters
    const r = random.pickOne(types);
    mat.stash[r] -= 1;
    burned[r] = (burned[r] ?? 0) + 1;
    remaining -= 1;
  }

  // Append a single audit entry summarizing the round's burn. The signed
  // delta is *negative* (resources left the village), even though they
  // didn't pass through `G.bank` — keeps the chief tooltip's "where did
  // tokens go?" story consistent.
  let any = false;
  const delta: Partial<ResourceBag> = {};
  for (const r of RESOURCES) {
    const v = burned[r];
    if (v === undefined || v === 0) continue;
    delta[r] = -v;
    any = true;
  }
  if (any) {
    appendBankLog(G, 'centerBurn', delta, detail);
  }

  return burned;
};
