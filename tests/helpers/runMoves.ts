// Drives a sequence of moves through a headless client.
//
// `runMoves` is the canonical way for tests to play a scripted game without
// reaching into bgio's internals. It switches the client's playerID before
// each call so once 02.2 introduces stages/activePlayers the same script
// keeps working.

import type { SettlementState } from '../../src/game/types.ts';
import type { TestClient } from './makeClient.ts';

export interface MoveCall {
  player: string;
  move: string;
  args?: unknown[];
}

export const runMoves = (
  client: TestClient,
  calls: ReadonlyArray<MoveCall>,
): void => {
  for (const call of calls) {
    // bgio's headless `Client` exposes `updatePlayerID` to swap the acting
    // seat between calls.
    client.updatePlayerID(call.player);

    const move = (client.moves as Record<string, (...args: unknown[]) => void>)[
      call.move
    ];
    if (typeof move !== 'function') {
      // Mirrors bgio's own behavior — log and continue. Tests assert on the
      // resulting state rather than throwing here so a single bad call doesn't
      // mask the rest of the script.
      console.error(`runMoves: unknown move '${call.move}'`);
      continue;
    }
    move(...(call.args ?? []));
  }
};

// Re-exported so callers don't need a separate import for the state shape
// when authoring scripts.
export type { SettlementState };
