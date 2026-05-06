// 08.3 — `eventResolve` follow-up move.
//
// When a play*Event move dispatches an `awaitInput`-shaped effect, the
// dispatcher parks the effect on `G._awaitingInput[playerID]` and pushes
// the seat into the `playingEvent` stage. `eventResolve` is the follow-up
// move the seat calls with the user-supplied payload to apply the effect,
// after which it pops the seat back to the prior stage via
// `exitEventStage`.
//
// Validations:
//   1. caller has a defined playerID
//   2. seat is in the `playingEvent` stage
//   3. an effect is parked at `G._awaitingInput[playerID]`
//
// On success: applies the deferred effect, clears the awaiting-input
// slot, and pops the prior stage.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../types.ts';
import type { EventEffect } from './effects.ts';
import {
  exitEventStage,
  STAGES,
  type StageEvents,
} from '../phases/stages.ts';

export const eventResolve: Move<SettlementState> = (
  { G, ctx, playerID, events },
  payload: unknown,
) => {
  void payload;
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  const stage = (
    ctx as unknown as { activePlayers?: Record<string, string> }
  )?.activePlayers?.[playerID];
  if (stage !== STAGES.playingEvent) return INVALID_MOVE;

  const effect: EventEffect | undefined = G._awaitingInput?.[playerID];
  if (effect === undefined) return INVALID_MOVE;

  switch (effect.kind) {
    case 'awaitInput': {
      break;
    }
    default: {
      throw new Error(
        `eventResolve: no handler for parked effect kind '${effect.kind}'`,
      );
    }
  }

  if (G._awaitingInput !== undefined) {
    delete G._awaitingInput[playerID];
  }
  const evts = events as StageEvents | undefined;
  if (evts !== undefined) {
    exitEventStage(G, playerID, evts);
  }
};
