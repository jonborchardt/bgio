// chiefPlayGoldEvent (04.4) — promoted to a real move in 08.3.
//
// The Chief plays one gold-color event card during the round. This move
// owns:
//   - "may I play?" gating (caller holds chief, has the card in their gold
//     hand, hasn't already played a gold event this round)
//   - bookkeeping: advance the per-seat event cycle (08.1's `cycleAdvance`)
//     and set the per-round ledger flag.
//   - 08.3 effect dispatch via 08.2's typed dispatcher.
//
// chiefPlayGoldEvent keeps its own hand-rolled file (rather than calling
// the `playEventStub` factory) because it landed first and its module-
// level docs spell out the contract that the factory now formalizes. The
// two implementations are behaviorally identical — see the parity tests
// under tests/roles/<role>/play<Color>Event.test.ts.
//
// Validations (in order):
//   1. caller has a defined playerID
//   2. caller holds the chief role
//   3. `G.events !== undefined`
//   4. `cardID` is in `G.events.hands.gold[playerID]` (compared by id —
//      this naturally rejects wrong-color cards: a blue card the chief
//      could never get into the gold hand to begin with)
//   5. chief has not already played a gold event this round
//      (`G._eventPlayedThisRound?.chief !== true`)
//
// On success: lazy-init `G._eventPlayedThisRound`, set the chief flag,
// advance the gold cycle for this seat with the played card id, then
// dispatch the card's effects.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { cycleAdvance } from '../../events/state.ts';
import { dispatch } from '../../events/dispatcher.ts';
import { fromBgio, type BgioRandomLike } from '../../random.ts';
import type { StageEvents, StageName } from '../../phases/stages.ts';
import { markUndoable } from '../../undo.ts';

export const chiefPlayGoldEvent: Move<SettlementState> = (
  { G, ctx, playerID, random, events },
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

  // Resolve the played card so we can hand it to the dispatcher.
  const card = goldHand.find((c) => c.id === cardID)!;

  // All checks passed — snapshot before any mutation so the dispatched
  // effects (which can ripple through bank, modifiers, hands, …) roll
  // back as one atomic unit.
  markUndoable(G, `Play ${card.name}`, playerID);

  // Bookkeeping.
  if (!G._eventPlayedThisRound) G._eventPlayedThisRound = {};
  G._eventPlayedThisRound.chief = true;

  // Advance the per-seat gold cycle (08.1). The hand isn't mutated here —
  // hands are the seat's visible options; what changes is `used`, which
  // resets after a full cycle so the same cards become legal again.
  cycleAdvance(G.events, 'gold', playerID, cardID);

  // 08.3 — dispatch effects. `random` may be missing in headless test
  // call sites that drive the move directly; fall back to a tiny identity
  // stub so the dispatcher (which currently doesn't need randomness for
  // any of the V1 effect kinds) can still run.
  const fallbackRandom: BgioRandomLike = {
    Shuffle: <T>(arr: T[]): T[] => [...arr],
    Number: () => 0,
  };
  const r = fromBgio((random as BgioRandomLike | undefined) ?? fallbackRandom);

  const returnTo = (
    ctx as unknown as { activePlayers?: Record<string, string> }
  )?.activePlayers?.[playerID];

  dispatch(G, ctx, r, card, undefined, {
    playerID,
    events: events as StageEvents | undefined,
    returnTo: returnTo as StageName | undefined,
  });
};
