// End-condition logic for the Settlement game.
//
// Two ways the game can end:
//   1. **Win** — `G.bossResolved === true`. Phase 2.7 will set this flag
//      when the village survives the boss card on the global event track.
//      Until then the flag is never set, so the only end-of-game outcome
//      is `timeUp` below. (Defense redesign 1.5 — D25.)
//   2. **Time up** — `G.round >= G.turnCap` (default 80, tunable per match).
//      Not a "lose" — no punishment, no recovery mechanic. The run ends so
//      the server can record the score and the player tries again to win
//      faster. The cap also makes RandomBot fuzz games terminate cleanly.
//
// Win takes precedence: if `bossResolved` flips on the same round the cap
// is hit, return `'win'`.
//
// Pure module — no boardgame.io runtime imports. The bgio `Game.endIf`
// signature is `({ G, ctx }) => undefined | object`; returning a truthy
// value sets `ctx.gameover` to that object. We export a 2-arg `endIf` so
// the game-config wiring can adapt the bgio shape to ours.

import type { SettlementState } from './types.ts';

export type GameOutcome =
  | { kind: 'win'; turns: number }
  | { kind: 'timeUp'; turns: number };

export const TURN_CAP_DEFAULT = 80;

export const endIf = (
  G: SettlementState,
  // ctx is unused today but kept on the signature so future end-conditions
  // (e.g. a phase-bound check) can reach into ctx without a fresh wiring.
  _ctx: unknown,
): GameOutcome | undefined => {
  if (G.bossResolved === true) {
    return { kind: 'win', turns: G.round };
  }
  const cap = G.turnCap ?? TURN_CAP_DEFAULT;
  if (G.round >= cap) {
    return { kind: 'timeUp', turns: G.round };
  }
  return undefined;
};
