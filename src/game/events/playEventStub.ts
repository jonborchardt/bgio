// Shared "play one event card of <color>" factory for the four role
// event-play moves: 04.4 chiefPlayGoldEvent, 05.4 sciencePlayBlueEvent,
// 06.6 domesticPlayGreenEvent, 07.6 foreignPlayRedEvent.
//
// Why a factory rather than four near-identical files: each only differs
// in (role, color, flag key). All five pieces of logic are identical —
// caller-seat check, role check, `G.events` presence check, hand-id
// lookup, per-round flag, the `cycleAdvance` bookkeeping call, and
// (08.3) the dispatch into `events/dispatcher.ts`. Centralizing keeps
// the moves in lockstep.
//
// 04.4 chiefPlayGoldEvent intentionally keeps its own hand-rolled file
// because it landed first and its module-level docs spell out the gating
// contract. The two are behaviorally identical — see chiefPlayGoldEvent.ts
// and the parity tests under tests/roles/<role>/play<Color>Event.test.ts.
//
// Validations (in order):
//   1. caller has a defined playerID
//   2. caller holds `role`
//   3. `G.events !== undefined`
//   4. `cardID` is in `G.events.hands[color][playerID]` (compared by id)
//   5. `G._eventPlayedThisRound?.[flagKey] !== true`
//
// On success: lazy-init `G._eventPlayedThisRound`, set the role's flag,
// advance the per-seat color cycle with the played card id, then call
// the typed effect dispatcher (08.2) to apply / queue the card's effects.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState, Role } from '../types.ts';
import { rolesAtSeat } from '../roles.ts';
import { cycleAdvance, type EventColor } from './state.ts';
import { dispatch } from './dispatcher.ts';
import { fromBgio, type BgioRandomLike } from '../random.ts';
import type { StageEvents, StageName } from '../phases/stages.ts';
import { markUndoable } from '../undo.ts';

// Type alias for the per-role flag keys on `_eventPlayedThisRound`.
// Lifted from `SettlementState` so a typo here would be a compile error.
type EventPlayedFlagKey = keyof NonNullable<
  SettlementState['_eventPlayedThisRound']
>;

export const playEventStub = (
  role: Role,
  color: EventColor,
  flagKey: EventPlayedFlagKey,
): Move<SettlementState> => {
  return ({ G, ctx, playerID, random, events }, cardID: string) => {
    // bgio passes the acting seat as a top-level `playerID`. Spectator /
    // unauthenticated calls arrive as `undefined`.
    if (playerID === undefined || playerID === null) return INVALID_MOVE;

    // Caller must hold the role.
    if (!rolesAtSeat(G.roleAssignments, playerID).includes(role)) {
      return INVALID_MOVE;
    }

    // 08 dependency: the events slice must be present for any of the rest
    // to be meaningful. Tests that build a SettlementState without
    // `events` exercise this path.
    if (G.events === undefined) return INVALID_MOVE;

    // The card must be in the role's color hand. We compare by id so the
    // caller can pass an id without holding the card object. This also
    // naturally rejects wrong-color cards: a card of another color could
    // never end up in this color's hand to begin with.
    const hand = G.events.hands[color][playerID];
    if (!hand || !hand.some((c) => c.id === cardID)) {
      return INVALID_MOVE;
    }

    // One event of this color per round.
    if (G._eventPlayedThisRound?.[flagKey] === true) return INVALID_MOVE;

    // Resolve the played card so we can hand it to the dispatcher.
    const card = hand.find((c) => c.id === cardID)!;

    // All checks passed — snapshot before any mutation so the dispatched
    // effects (which can ripple through bank, modifiers, hands, …) roll
    // back as one atomic unit.
    markUndoable(G, `Play ${card.name}`, playerID);

    // Bookkeeping.
    if (!G._eventPlayedThisRound) G._eventPlayedThisRound = {};
    G._eventPlayedThisRound[flagKey] = true;

    // Advance the per-seat cycle for this color (08.1). The hand isn't
    // mutated here — hands are the seat's visible options; what changes
    // is `used`, which resets after a full cycle so the same cards
    // become legal again.
    cycleAdvance(G.events, color, playerID, cardID);

    // 08.3 — dispatch effects. `random` may be missing in headless test
    // call sites that drive the move directly; fall back to a tiny
    // identity stub so the dispatcher (which currently doesn't need
    // randomness for any of the V1 effect kinds) can still run.
    const fallbackRandom: BgioRandomLike = {
      Shuffle: <T>(arr: T[]): T[] => [...arr],
      Number: () => 0,
    };
    const r = fromBgio((random as BgioRandomLike | undefined) ?? fallbackRandom);

    // The seat's current stage — used by `awaitInput`-shaped effects so
    // `exitEventStage` can pop back to it. Loose-typed because some test
    // ctx stubs lack `activePlayers`.
    const returnTo = (
      ctx as unknown as { activePlayers?: Record<string, string> }
    )?.activePlayers?.[playerID];

    dispatch(G, ctx, r, card, undefined, {
      playerID,
      events: events as StageEvents | undefined,
      returnTo: returnTo as StageName | undefined,
    });
  };
};
