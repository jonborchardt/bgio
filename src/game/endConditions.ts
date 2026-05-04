// End-condition logic for the Settlement game.
//
// Two ways the game can end:
//   1. **Win** — `G.bossResolved === true`. Phase 2.7's `resolveBoss`
//      flips this when the village survives the boss card on the global
//      event track. (Defense redesign 1.5 — D25.)
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
//
// `onEnd` records a flat score snapshot onto `G._score` so server-side
// persistence (10.7) and the eventual lobby summary (Phase 3 UI) can
// read post-mortem stats without re-walking the live state. The score
// payload includes the outcome, the round count, the village's
// surviving building count + average HP %, and the units-alive count.
// All values are computed off `G` at call time — no I/O, no randomness.

import type { SettlementState } from './types.ts';

export type GameOutcome =
  | { kind: 'win'; turns: number }
  | { kind: 'timeUp'; turns: number };

export const TURN_CAP_DEFAULT = 80;

/** Flat score snapshot written by `onEnd`. The fields here are the V1
 *  surface; Phase 3 UI / server persistence (10.7) read this map to
 *  render or upload a run summary. Optional on `SettlementState` so
 *  pre-2.7 fixtures stay source-compatible. */
export interface RunScore {
  outcome: 'win' | 'timeUp';
  rounds: number;
  buildingsAtEnd: number;
  // 0..100 inclusive, integer. Average of `(hp / maxHp) * 100` across
  // every non-center building in the grid. 100 when every building is
  // pristine; 0 (with `buildingsAtEnd === 0`) when the grid is bare.
  hpRetainedPct: number;
  unitsAlive: number;
}

const countNonCenterBuildings = (G: SettlementState): number => {
  const grid = G.domestic?.grid ?? {};
  let n = 0;
  for (const b of Object.values(grid)) {
    if (b.isCenter === true) continue;
    n += 1;
  }
  return n;
};

const avgHpPct = (G: SettlementState): number => {
  const grid = G.domestic?.grid ?? {};
  let total = 0;
  let count = 0;
  for (const b of Object.values(grid)) {
    if (b.isCenter === true) continue;
    if (b.maxHp <= 0) continue;
    total += (b.hp / b.maxHp) * 100;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round(total / count);
};

export const computeRunScore = (
  G: SettlementState,
  outcome: 'win' | 'timeUp',
): RunScore => ({
  outcome,
  rounds: G.round,
  buildingsAtEnd: countNonCenterBuildings(G),
  hpRetainedPct: avgHpPct(G),
  unitsAlive: G.defense?.inPlay.length ?? 0,
});

export const endIf = (
  G: SettlementState,
  // ctx is unused today but kept on the signature so future end-conditions
  // (e.g. a phase-bound check) can reach into ctx without a fresh wiring.
  _ctx: unknown,
): GameOutcome | undefined => {
  if (G.bossResolved === true) {
    return { kind: 'win', turns: G.turnsAtWin ?? G.round };
  }
  const cap = G.turnCap ?? TURN_CAP_DEFAULT;
  if (G.round >= cap) {
    return { kind: 'timeUp', turns: G.round };
  }
  return undefined;
};

/** bgio's `Game.onEnd` runs once when `endIf` first returns a truthy
 *  value. We use it to write the final score snapshot onto `G._score`.
 *  Pure mutation; safe to call directly from tests with a hand-rolled
 *  state. */
export const onEnd = (G: SettlementState): void => {
  const out = endIf(G, undefined);
  // `onEnd` only runs once endIf has fired, but defend against direct
  // calls with no live outcome — we pick `timeUp` as the fallback
  // (matches "ran out of time without winning").
  const outcome: 'win' | 'timeUp' = out?.kind === 'win' ? 'win' : 'timeUp';
  G._score = computeRunScore(G, outcome);
};
