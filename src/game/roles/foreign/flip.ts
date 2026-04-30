// 07.4 — Foreign flip flow: foreignFlipBattle / foreignFlipTrade.
//
// `foreignAssignDamage` lives in its sibling file `assignDamage.ts` so the
// resolver-import surface stays local to the move that uses it.
//
// game-design.md §General Play (Foreign turn):
//   1. Pay upkeep (07.2).
//   2. Optionally recruit / release (07.2).
//   3. Optionally flip a battle card. If you win, you may flip a trade
//      card next. Flipping is "until you fail" — V1 leaves the loop to
//      the caller (no auto-loop in this move).
//
// `foreignFlipBattle` pulls the top of `G.foreign.battleDeck` into
// `inFlight.battle`, snapshots `inPlay` into `inFlight.committed`, and
// hands control over to `foreignAssignDamage` via the
// `foreignAwaitingDamage` stage.
//
// `foreignFlipTrade` is only legal after a winning battle. It pulls the
// top of `tradeDeck`, builds a `TradeRequest`, and either places it into
// `centerMat.tradeRequest` or — if the slot is occupied — stashes the
// card and flags the chief to decide (see `tradeRequest.ts`).
//
// "Restore HP" (game-design.md "Restore the health of all units before
// each flip"): a no-op in V1 because `inPlay` only carries counts
// (`UnitInstance`). The resolver re-derives per-row HP from each unit's
// `defense` every battle, so the snapshot is already at full HP.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { STAGES } from '../../phases/stages.ts';
import type { StageEvents } from '../../phases/stages.ts';
import { placeOrInterruptTrade } from './tradeRequest.ts';

export const foreignFlipBattle: Move<SettlementState> = ({
  G,
  ctx,
  events,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== STAGES.foreignTurn) {
    return INVALID_MOVE;
  }

  const foreign = G.foreign;
  if (foreign === undefined) return INVALID_MOVE;

  // Only one battle in flight at a time. The caller must resolve the
  // current battle (via `foreignAssignDamage`) before flipping again.
  if (foreign.inFlight.battle !== null) return INVALID_MOVE;

  if (foreign.battleDeck.length === 0) return INVALID_MOVE;

  // Top of deck = index 0 (per the deck-construction comment in decks.ts:
  // "lowest number on top"). Mutates the deck in place under Immer.
  const drawn = foreign.battleDeck.shift()!;

  foreign.inFlight.battle = drawn;
  // Snapshot inPlay into committed. V1 takes the full inPlay roster as
  // committed; a future revision could add a "commit subset" move before
  // assigning damage.
  foreign.inFlight.committed = foreign.inPlay.map((u) => ({ ...u }));

  // Clear the prior battle's outcome so a stale 'win' can't unlock the
  // trade flip across the upcoming resolve boundary.
  foreign.lastBattleOutcome = undefined;

  // Hand control to `foreignAssignDamage`. setStage acts on the calling
  // seat, which is the Foreign seat — exactly who we want to gate on.
  const evts = events as StageEvents | undefined;
  evts?.setStage?.(STAGES.foreignAwaitingDamage);

  foreign._lastRelease = undefined;
};

export const foreignFlipTrade: Move<SettlementState> = ({
  G,
  ctx,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== STAGES.foreignTurn) {
    return INVALID_MOVE;
  }

  const foreign = G.foreign;
  if (foreign === undefined) return INVALID_MOVE;

  // Only legal after a winning battle.
  if (foreign.lastBattleOutcome !== 'win') return INVALID_MOVE;

  if (foreign.tradeDeck.length === 0) return INVALID_MOVE;

  const drawn = foreign.tradeDeck.shift()!;
  placeOrInterruptTrade(G, drawn, playerID);

  // Trade-flip is a one-shot per win — clear the outcome so the player
  // can't flip a second trade card off the same battle. They'd need to
  // win another battle first.
  foreign.lastBattleOutcome = undefined;

  foreign._lastRelease = undefined;
};
