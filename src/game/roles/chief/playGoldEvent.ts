// chiefPlayGoldEvent (04.4) — STUB.
//
// The Chief plays one gold-color event card during the round. The actual
// effect dispatch lives in 08.2 (the typed effect dispatcher) and 08.3
// (concrete card surface implementations). This stub only owns:
//   - "may I play?" gating (caller holds chief, has the card in their gold
//     hand, hasn't already played a gold event this round)
//   - bookkeeping: advance the per-seat event cycle (08.1's `cycleAdvance`)
//     and set the per-round ledger flag.
//
// TODO(08.3): once the dispatcher and card surface exist, this move should
// also resolve the card's effects (calling into 08.2's dispatcher, and
// possibly entering the `playingEvent` stage via `enterEventStage` if the
// effects need user follow-up). Until then we just mark the play.
//
// Validations (in order):
//   1. caller has a defined playerID
//   2. caller holds the chief role
//   3. `G.events !== undefined` (08.1 dependency — soft until 08 is fully
//      wired everywhere; the existing setup ships events but defensive
//      tests can pass a state without it)
//   4. `cardID` is in `G.events.hands.gold[playerID]` (compared by id —
//      this naturally rejects wrong-color cards: a blue card the chief
//      could never get into the gold hand to begin with)
//   5. chief has not already played a gold event this round
//      (`G._eventPlayedThisRound?.chief !== true`)
//
// On success: lazy-init `G._eventPlayedThisRound`, set the chief flag,
// advance the gold cycle for this seat with the played card id.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { cycleAdvance } from '../../events/state.ts';

export const chiefPlayGoldEvent: Move<SettlementState> = (
  { G, playerID },
  cardID: string,
) => {
  // bgio passes the acting seat as a top-level `playerID`. Spectator /
  // unauthenticated calls arrive as `undefined`.
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  // Caller must hold the chief role.
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('chief')) {
    return INVALID_MOVE;
  }

  // 08 dependency: the events slice must be present for any of the rest to
  // be meaningful. Tests that build a SettlementState without `events`
  // exercise this path.
  if (G.events === undefined) return INVALID_MOVE;

  // The card must be in the chief's gold hand. We compare by id so the
  // caller can pass an id without holding the card object.
  const goldHand = G.events.hands.gold[playerID];
  if (!goldHand || !goldHand.some((c) => c.id === cardID)) {
    return INVALID_MOVE;
  }

  // One gold event per round.
  if (G._eventPlayedThisRound?.chief === true) return INVALID_MOVE;

  // All checks passed — bookkeeping. The actual effect dispatch lands in
  // 08.3 (see TODO at top of file).
  if (!G._eventPlayedThisRound) G._eventPlayedThisRound = {};
  G._eventPlayedThisRound.chief = true;

  // Advance the per-seat gold cycle (08.1). The hand isn't mutated here —
  // hands are the seat's visible options; what changes is `used`, which
  // resets after a full cycle so the same cards become legal again.
  cycleAdvance(G.events, 'gold', playerID, cardID);
};
