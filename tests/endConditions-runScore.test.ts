// Issue 030 — focused coverage for `computeRunScore`. The pre-existing
// `endConditions.test.ts` only checks the win/timeUp dispatch; this
// file pins the per-field shape of the snapshot the bgio `onEnd`
// hook stamps onto `G._score`.

import { describe, expect, it } from 'vitest';
import {
  computeRunScore,
  onEnd,
} from '../src/game/endConditions.ts';
import type { SettlementState } from '../src/game/types.ts';
import { initialBank } from '../src/game/resources/bank.ts';
import { assignRoles } from '../src/game/roles.ts';

const baseG = (): SettlementState =>
  ({
    bank: initialBank(),
    roleAssignments: assignRoles(2),
    round: 0,
    bossResolved: false,
    mats: {},
    hands: {},
    domestic: { hand: [], grid: {}, techHand: [] },
    defense: { hand: [], inPlay: [] },
  }) as unknown as SettlementState;

describe('computeRunScore (issue 030)', () => {
  it('reports a zero-building average HP as 0, not NaN', () => {
    const G = baseG();
    const score = computeRunScore(G, 'win');
    expect(score.outcome).toBe('win');
    expect(score.buildingsAtEnd).toBe(0);
    expect(score.hpRetainedPct).toBe(0);
    expect(Number.isFinite(score.hpRetainedPct)).toBe(true);
  });

  it('rounds the HP-retained percentage to the nearest integer', () => {
    const G = baseG();
    G.domestic = {
      hand: [],
      techHand: [],
      grid: {
        '0,0': { defID: 'A', upgrades: 0, worker: null, hp: 1, maxHp: 3 },
        '1,0': { defID: 'B', upgrades: 0, worker: null, hp: 2, maxHp: 3 },
      },
    } as unknown as typeof G.domestic;
    // (1/3 + 2/3) / 2 * 100 = 50% exactly.
    const score = computeRunScore(G, 'timeUp');
    expect(score.hpRetainedPct).toBe(50);
  });

  it('skips the center tile when averaging building HP', () => {
    const G = baseG();
    G.domestic = {
      hand: [],
      techHand: [],
      grid: {
        // Center tile at (0,0) carries `isCenter: true` — must NOT
        // contribute to the average even with a wonky maxHp.
        '0,0': {
          defID: 'CENTER',
          upgrades: 0,
          worker: null,
          hp: 0,
          maxHp: 0,
          isCenter: true,
        },
        '1,0': { defID: 'A', upgrades: 0, worker: null, hp: 4, maxHp: 4 },
      },
    } as unknown as typeof G.domestic;
    const score = computeRunScore(G, 'win');
    expect(score.buildingsAtEnd).toBe(1);
    expect(score.hpRetainedPct).toBe(100);
  });

  it("counts G.defense.inPlay's length for `unitsAlive`", () => {
    const G = baseG();
    G.defense = {
      hand: [],
      inPlay: [
        { id: 'u1', defID: 'Scout', cellKey: '0,0', hp: 1, placementOrder: 1 },
        { id: 'u2', defID: 'Scout', cellKey: '0,1', hp: 1, placementOrder: 2 },
        { id: 'u3', defID: 'Scout', cellKey: '0,2', hp: 1, placementOrder: 3 },
      ],
    } as unknown as typeof G.defense;
    const score = computeRunScore(G, 'win');
    expect(score.unitsAlive).toBe(3);
  });

  it('writes the score onto G._score via onEnd', () => {
    const G = baseG();
    G.bossResolved = true; // forces endIf → 'win'
    G.turnsAtWin = 12;
    onEnd(G);
    expect(G._score).toBeDefined();
    expect(G._score!.outcome).toBe('win');
    expect(G._score!.rounds).toBe(0);
  });
});
