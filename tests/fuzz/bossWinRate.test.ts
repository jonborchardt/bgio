// Defense redesign 2.7 — full-track bot run, win-rate gate.
//
// Per orchestrator §6, sub-phase 2.7 ships with an additional gate: a
// scripted full-track bot run must produce at least one `won: true`
// outcome out of N=5 trials. This file is that gate.
//
// The driver is a "scripted bot" — not RandomBot. We force the chief to
// flip the track every round and force every non-chief seat to call
// `seatDone` immediately so the engine cycles cleanly through every
// card on the track. With 33 cards in `trackCards.json` (phases 1..9
// of 3-4 cards each + the boss in phase 10), 33 forced rounds reach
// the boss.
//
// The win condition is `G.bossResolved`, which `resolveBoss` flips
// unconditionally after running its printed attack pattern (no fail
// mode — D26). So *any* full-track run that reaches the boss flip
// wins. The test exists to:
//   1. Confirm the boss card can be reached without errors,
//   2. Confirm `endIf` returns `kind: 'win'` after the boss flip,
//   3. Confirm `onEnd` writes a `_score` snapshot with `outcome: 'win'`.
//
// Five trials are driven with five different seeds so the suite catches
// regressions where a particular card permutation breaks the resolver
// pipeline (e.g. a path geometry edge case the determinism test in
// resolver.spec.ts wouldn't surface).

import { describe, expect, it } from 'vitest';
import { makeClient } from '../helpers/makeClient.ts';
import { runMoves } from '../helpers/runMoves.ts';
import { seatOfRole } from '../../src/game/roles.ts';
import { TRACK_CARDS } from '../../src/data/index.ts';

// 33 in current content; pad a few rounds so the loop tolerates content
// changes that add a card or two without rewriting the gate.
const MAX_ROUNDS = TRACK_CARDS.length + 5;

interface Trial {
  seed: string;
  won: boolean;
  rounds: number;
  reachedBoss: boolean;
  outcomeKind?: 'win' | 'timeUp';
}

const driveOneTrial = (seed: string): Trial => {
  // Larger turnCap than default so the boss can be reached even if a
  // few rounds fail to advance the track. The default is 80, plenty.
  const client = makeClient({ numPlayers: 4, seed });
  const a = client.getState()!.G.roleAssignments;
  const chiefSeat = seatOfRole(a, 'chief');
  const sci = seatOfRole(a, 'science');
  const dom = seatOfRole(a, 'domestic');
  const def = seatOfRole(a, 'defense');

  let reachedBoss = false;
  let rounds = 0;

  for (let r = 0; r < MAX_ROUNDS; r += 1) {
    const stateBefore = client.getState();
    if (stateBefore === null) break;
    if (stateBefore.ctx.gameover !== undefined) break;

    // Note whether this round's flip is the boss before we trigger it.
    const nextCard = stateBefore.G.track?.upcoming[0];
    if (nextCard?.kind === 'boss') reachedBoss = true;

    // Force the round forward: chief flip + end, everyone else done.
    runMoves(client, [
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
      { player: sci, move: 'scienceSeatDone' },
      { player: dom, move: 'domesticSeatDone' },
      { player: def, move: 'defenseSeatDone' },
    ]);
    rounds = r + 1;

    const after = client.getState();
    if (after === null) break;
    if (after.ctx.gameover !== undefined) break;
  }

  const final = client.getState();
  const gameover = final?.ctx.gameover as
    | { kind: 'win' | 'timeUp'; turns: number }
    | undefined;
  return {
    seed,
    won: final?.G.bossResolved === true,
    rounds,
    reachedBoss,
    outcomeKind: gameover?.kind,
  };
};

describe('Full-track bot run (defense redesign 2.7 win-rate gate)', () => {
  // Five trials. Each one seeds bgio's PluginRandom differently, so the
  // per-phase shuffle order in `buildTrack` differs and the test exercises
  // a handful of card permutations.
  const seeds = [
    'win-rate-1',
    'win-rate-2',
    'win-rate-3',
    'win-rate-4',
    'win-rate-5',
  ];

  it('at least 1 of 5 scripted full-track trials wins', () => {
    const trials = seeds.map(driveOneTrial);
    const wins = trials.filter((t) => t.won).length;
    // Surface diagnostic info on failure so we can see which trial(s)
    // didn't reach the boss.
    if (wins === 0) {
      console.error('No wins in 5 trials. Trial summaries:', trials);
    }
    expect(wins).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('every trial reaches the boss card and records a win outcome', () => {
    // The driver is deterministic: with the boss as the unique last card
    // and chief-forced flips every round, every trial should reach the
    // boss. This stronger assertion makes regressions actionable when
    // somebody changes the round shape or the loader contract.
    for (const seed of seeds) {
      const trial = driveOneTrial(seed);
      expect(trial.reachedBoss, `seed=${seed} reached boss`).toBe(true);
      expect(trial.won, `seed=${seed} bossResolved`).toBe(true);
      expect(trial.outcomeKind, `seed=${seed} outcome kind`).toBe('win');
    }
  }, 120000);

  it('full-track win records a score snapshot via onEnd', () => {
    const client = makeClient({ numPlayers: 4, seed: 'score-1' });
    const a = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(a, 'chief');
    const sci = seatOfRole(a, 'science');
    const dom = seatOfRole(a, 'domestic');
    const def = seatOfRole(a, 'defense');
    for (let r = 0; r < MAX_ROUNDS; r += 1) {
      const s = client.getState();
      if (s === null) break;
      if (s.ctx.gameover !== undefined) break;
      runMoves(client, [
        { player: chiefSeat, move: 'chiefFlipTrack' },
        { player: chiefSeat, move: 'chiefEndPhase' },
        { player: sci, move: 'scienceSeatDone' },
        { player: dom, move: 'domesticSeatDone' },
        { player: def, move: 'defenseSeatDone' },
      ]);
    }
    const final = client.getState();
    expect(final?.ctx.gameover).toBeDefined();
    // bgio runs the game-level `onEnd` after `endIf` first returns
    // truthy; our `onEnd` writes `_score`. The score's outcome must
    // mirror `gameover.kind`.
    const score = final?.G._score;
    expect(score).toBeDefined();
    expect(score!.outcome).toBe('win');
    expect(score!.rounds).toBeGreaterThanOrEqual(1);
    expect(score!.unitsAlive).toBeGreaterThanOrEqual(0);
    expect(score!.buildingsAtEnd).toBeGreaterThanOrEqual(0);
    expect(score!.hpRetainedPct).toBeGreaterThanOrEqual(0);
    expect(score!.hpRetainedPct).toBeLessThanOrEqual(100);
  }, 60000);
});
