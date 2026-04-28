// 08.3 — `eventResolve` follow-up move.
//
// When a play*Event move dispatches an `awaitInput`-shaped effect (e.g.
// `swapTwoScienceCards`), the dispatcher parks the effect on
// `G._awaitingInput[playerID]` and pushes the seat into the
// `playingEvent` stage. `eventResolve` is the follow-up move the seat
// calls with the user-supplied payload to apply the effect, after which
// it pops the seat back to the prior stage via `exitEventStage`.
//
// V1 supports `swapTwoScienceCards`. The payload shape for the swap is
// `{ a: string; b: string }` — two science-grid card ids; the move
// finds them in `G.science.grid` and swaps their positions in place.
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

interface SwapPayload {
  a: string;
  b: string;
}

const isSwapPayload = (v: unknown): v is SwapPayload =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as { a?: unknown }).a === 'string' &&
  typeof (v as { b?: unknown }).b === 'string';

const applySwapTwoScienceCards = (
  G: SettlementState,
  payload: SwapPayload,
): typeof INVALID_MOVE | void => {
  if (G.science === undefined) return INVALID_MOVE;
  const grid = G.science.grid;

  // Locate `a` and `b` by id and swap their positions in the grid.
  let aPos: { col: number; row: number } | null = null;
  let bPos: { col: number; row: number } | null = null;
  for (let col = 0; col < grid.length; col++) {
    const column = grid[col]!;
    for (let row = 0; row < column.length; row++) {
      const card = column[row]!;
      if (card.id === payload.a) aPos = { col, row };
      else if (card.id === payload.b) bPos = { col, row };
    }
  }
  if (aPos === null || bPos === null) return INVALID_MOVE;

  const aCol = grid[aPos.col]!;
  const bCol = grid[bPos.col]!;
  const tmp = aCol[aPos.row]!;
  aCol[aPos.row] = bCol[bPos.row]!;
  bCol[bPos.row] = tmp;
};

export const eventResolve: Move<SettlementState> = (
  { G, ctx, playerID, events },
  payload: unknown,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  // Must be in `playingEvent`. Loose-typed because some test ctx stubs
  // omit `activePlayers`.
  const stage = (
    ctx as unknown as { activePlayers?: Record<string, string> }
  )?.activePlayers?.[playerID];
  if (stage !== STAGES.playingEvent) return INVALID_MOVE;

  const effect: EventEffect | undefined = G._awaitingInput?.[playerID];
  if (effect === undefined) return INVALID_MOVE;

  switch (effect.kind) {
    case 'swapTwoScienceCards': {
      if (!isSwapPayload(payload)) return INVALID_MOVE;
      const result = applySwapTwoScienceCards(G, payload);
      if (result === INVALID_MOVE) return INVALID_MOVE;
      break;
    }
    case 'awaitInput': {
      // V1: no concrete handler for the generic awaitInput flow. The
      // effect's `payloadKind` is the schema dispatch hint; once
      // additional handlers land, pivot on it here. For now we accept
      // the resolve and let the seat exit the stage.
      break;
    }
    default: {
      // The dispatcher only parks `swapTwoScienceCards` / `awaitInput`
      // here today, so anything else is a bug in the dispatcher.
      throw new Error(
        `eventResolve: no handler for parked effect kind '${effect.kind}'`,
      );
    }
  }

  // Clear the awaiting-input slot and pop the stage stack.
  if (G._awaitingInput !== undefined) {
    delete G._awaitingInput[playerID];
  }
  const evts = events as StageEvents | undefined;
  if (evts !== undefined) {
    exitEventStage(G, playerID, evts);
  }
};
