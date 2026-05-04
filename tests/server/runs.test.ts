// @vitest-environment node
//
// 10.7 — run-history tests.
//
// In-memory store; reset in `beforeEach`. Idempotency on (matchID,
// userID) is the most important contract — the bgio `endIf` hook can
// be re-fired (e.g. on server restart replay) and we need a stable
// view.
//
// 1.5 (D25): legacy `settlementsJoined` score field retired; runs only
// carry `outcome` + `turns` now.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetRunsForTest,
  listRunsByUser,
  personalBest,
  recordRun,
} from '../../server/runs/runs.ts';

beforeEach(() => {
  __resetRunsForTest();
});

describe('runs.recordRun (10.7)', () => {
  it('creates a record with an id and createdAt', async () => {
    const rec = await recordRun({
      userID: 'u1',
      matchID: 'm1',
      outcome: 'win',
      turns: 42,
    });
    expect(typeof rec.id).toBe('string');
    expect(rec.id.length).toBeGreaterThan(0);
    expect(rec.createdAt).toBeLessThanOrEqual(Date.now());
    expect(rec.outcome).toBe('win');
    expect(rec.turns).toBe(42);
  });

  it('is idempotent on (matchID, userID) — second call returns the original', async () => {
    const first = await recordRun({
      userID: 'u1',
      matchID: 'm1',
      outcome: 'win',
      turns: 42,
    });
    const second = await recordRun({
      userID: 'u1',
      matchID: 'm1',
      outcome: 'timeUp', // different fields ignored on the duplicate write
      turns: 999,
    });
    expect(second.id).toBe(first.id);
    expect(second.outcome).toBe('win');
    expect(second.turns).toBe(42);
  });

  it('different (matchID, userID) pairs each get their own record', async () => {
    const a = await recordRun({
      userID: 'u1',
      matchID: 'm1',
      outcome: 'win',
      turns: 10,
    });
    const b = await recordRun({
      userID: 'u1',
      matchID: 'm2',
      outcome: 'win',
      turns: 20,
    });
    const c = await recordRun({
      userID: 'u2',
      matchID: 'm1',
      outcome: 'win',
      turns: 30,
    });
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });
});

describe('runs.listRunsByUser (10.7)', () => {
  it('returns the user-scoped runs only, newest first', async () => {
    await recordRun({
      userID: 'u1',
      matchID: 'm1',
      outcome: 'win',
      turns: 10,
    });
    await recordRun({
      userID: 'u2',
      matchID: 'm1',
      outcome: 'win',
      turns: 12,
    });
    await recordRun({
      userID: 'u1',
      matchID: 'm2',
      outcome: 'timeUp',
      turns: 80,
    });
    const list = await listRunsByUser('u1');
    expect(list.length).toBe(2);
    expect(list.every((r) => r.userID === 'u1')).toBe(true);
    // Newest first: m2 was recorded after m1.
    expect(list[0]?.matchID).toBe('m2');
    expect(list[1]?.matchID).toBe('m1');
  });

  it('returns [] for an unknown user', async () => {
    const list = await listRunsByUser('nobody');
    expect(list).toEqual([]);
  });
});

describe('runs.personalBest (10.7)', () => {
  it('returns nulls for a user with no runs', async () => {
    const best = await personalBest('u1');
    expect(best.fastestWinTurns).toBeNull();
    expect(best.longestTimeUpTurns).toBeNull();
  });

  it('reports the lowest turns across wins and the highest turns across timeUps', async () => {
    await recordRun({
      userID: 'u1',
      matchID: 'm1',
      outcome: 'win',
      turns: 50,
    });
    await recordRun({
      userID: 'u1',
      matchID: 'm2',
      outcome: 'win',
      turns: 38,
    });
    await recordRun({
      userID: 'u1',
      matchID: 'm3',
      outcome: 'win',
      turns: 60,
    });
    await recordRun({
      userID: 'u1',
      matchID: 'm4',
      outcome: 'timeUp',
      turns: 60,
    });
    await recordRun({
      userID: 'u1',
      matchID: 'm5',
      outcome: 'timeUp',
      turns: 80,
    });
    await recordRun({
      userID: 'u1',
      matchID: 'm6',
      outcome: 'timeUp',
      turns: 50,
    });
    const best = await personalBest('u1');
    expect(best.fastestWinTurns).toBe(38);
    expect(best.longestTimeUpTurns).toBe(80);
  });

  it('does not leak across users', async () => {
    await recordRun({
      userID: 'u1',
      matchID: 'm1',
      outcome: 'win',
      turns: 10,
    });
    await recordRun({
      userID: 'u2',
      matchID: 'm2',
      outcome: 'win',
      turns: 99,
    });
    const best = await personalBest('u2');
    expect(best.fastestWinTurns).toBe(99);
  });
});
