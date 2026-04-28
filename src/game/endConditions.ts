// End-condition logic for the Settlement game.
//
// Two ways the game can end:
//   1. **Win** — `G.settlementsJoined >= 10`. game-design.md §Goal.
//   2. **Time up** — `G.round >= G.turnCap` (default 80, tunable per match).
//      Not a "lose" — no punishment, no recovery mechanic. The run ends so
//      the server can record the score and the player tries again to win
//      faster. The cap also makes RandomBot fuzz games terminate cleanly.
//
// Win takes precedence: if both fire on the same round, return `'win'`.
//
// Pure module — no boardgame.io runtime imports. The bgio `Game.endIf`
// signature is `({ G, ctx }) => undefined | object`; returning a truthy
// value sets `ctx.gameover` to that object. We export a 2-arg `endIf` so
// the game-config wiring can adapt the bgio shape to ours.

import type { SettlementState } from './types.ts';

export type GameOutcome =
  | { kind: 'win'; turns: number; settlementsJoined: number }
  | { kind: 'timeUp'; turns: number; settlementsJoined: number };

export const TURN_CAP_DEFAULT = 80;

export const endIf = (
  G: SettlementState,
  // ctx is unused today but kept on the signature so future end-conditions
  // (e.g. a phase-bound check) can reach into ctx without a fresh wiring.
  _ctx: unknown,
): GameOutcome | undefined => {
  const settlementsJoined = G.settlementsJoined;
  if (settlementsJoined >= 10) {
    return { kind: 'win', turns: G.round, settlementsJoined };
  }
  const cap = G.turnCap ?? TURN_CAP_DEFAULT;
  if (G.round >= cap) {
    return { kind: 'timeUp', turns: G.round, settlementsJoined };
  }
  return undefined;
};
