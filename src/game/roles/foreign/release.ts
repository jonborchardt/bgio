// foreignReleaseUnit (07.2) — decrement (or remove) a unit instance from
// `G.foreign.inPlay` and refund `floor(def.cost / 2)` per released unit to
// the foreign seat's stash.
//
// Used both as a routine action and as the escape-hatch when the Foreign
// seat can't cover their `foreignUpkeep` bill. The plan's V1 refund is
// fixed at half-cost (rounded down); tech / building "release value"
// modifiers can layer on later.
//
// Stage gating mirrors `foreignRecruit`: caller must hold `foreign` and be
// in the `foreignTurn` stage.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { UNITS } from '../../../data/index.ts';
import { appendBankLog } from '../../resources/bankLog.ts';

export const foreignReleaseUnit: Move<SettlementState> = (
  { G, ctx, playerID },
  defID: string,
  count?: number,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'foreignTurn') return INVALID_MOVE;

  const foreign = G.foreign;
  if (foreign === undefined) return INVALID_MOVE;

  const n = count ?? 1;
  if (!Number.isInteger(n) || n < 1) return INVALID_MOVE;

  const idx = foreign.inPlay.findIndex((u) => u.defID === defID);
  if (idx === -1) return INVALID_MOVE;
  const entry = foreign.inPlay[idx]!;
  if (entry.count < n) return INVALID_MOVE;

  const def = UNITS.find((u) => u.name === defID);
  if (def === undefined) return INVALID_MOVE;

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;

  // Refund half-cost (rounded down) per released unit. The refund comes
  // from the bank — we credit the stash directly, matching `payFromStash`
  // in reverse: a release is a partial undo of the recruit transaction.
  // If the bank can't cover the full refund, pay what it can and continue
  // — release must remain the escape hatch when upkeep is unaffordable,
  // so we never block the move on bank balance.
  const refundPerUnit = Math.floor(def.cost / 2);
  const refundIdeal = refundPerUnit * n;
  const refundTotal = Math.min(refundIdeal, G.bank.gold);
  if (refundTotal > 0) {
    G.bank.gold -= refundTotal;
    mat.stash.gold += refundTotal;
    appendBankLog(
      G,
      'release',
      { gold: -refundTotal },
      `Release ${defID}${n > 1 ? ` ×${n}` : ''}`,
    );
  }

  entry.count -= n;
  if (entry.count === 0) foreign.inPlay.splice(idx, 1);

  foreign._lastRelease = { defID, count: n, refundTotal };
};
