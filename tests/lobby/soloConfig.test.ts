// 11.7 — buildBotMap tests.
//
// Pure-data assertions: given a SoloConfig, the right seats end up in
// the bot map and the composed bot for each seat covers the roles that
// `assignRoles(numPlayers)` puts on that seat. We don't drive bgio in
// this file — the per-role bots already have their own integration
// tests. The composed-bot test asserts only that "first non-null wins"
// using stub state where exactly one of the owned roles will fire.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { buildBotMap } from '../../src/lobby/soloConfig.ts';
import { setup } from '../../src/game/setup.ts';
import type { PlayerID, SettlementState } from '../../src/game/types.ts';

const ctxFor = (
  phase: string,
  activePlayers?: Record<PlayerID, string>,
  numPlayers = 4,
): Ctx =>
  ({
    phase,
    activePlayers,
    turn: 1,
    numPlayers,
    playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
    playOrderPos: 0,
    currentPlayer: '0',
    numMoves: 0,
  }) as unknown as Ctx;

const setupG = (numPlayers: 1 | 2 | 3 | 4): SettlementState => {
  const ctx = { numPlayers } as unknown as Parameters<typeof setup>[0]['ctx'];
  return setup({ ctx });
};

describe('buildBotMap (11.7)', () => {
  it('2-player solo, humanRole=chief: bot covers seat 1 (domestic+defense)', () => {
    const map = buildBotMap({ numPlayers: 2, humanRole: 'chief' });
    // assignRoles(2): seat 0 = chief+science, seat 1 = domestic+defense.
    // humanRole=chief lives at seat 0 → only seat 1 has a bot.
    expect(Object.keys(map).sort()).toEqual(['1']);
    expect(typeof map['1']).toBe('function');
  });

  it('2-player solo, humanRole=defense: bot covers seat 0 (chief+science)', () => {
    const map = buildBotMap({ numPlayers: 2, humanRole: 'defense' });
    // humanRole=defense lives at seat 1 → only seat 0 has a bot.
    expect(Object.keys(map).sort()).toEqual(['0']);
    expect(typeof map['0']).toBe('function');
  });

  it('4-player solo, humanRole=domestic: 3 bot seats, one per non-domestic role', () => {
    const map = buildBotMap({ numPlayers: 4, humanRole: 'domestic' });
    // assignRoles(4): seats 0/1/2/3 = chief / science / domestic / defense.
    // Human is seat 2; bots cover seats 0, 1, 3.
    expect(Object.keys(map).sort()).toEqual(['0', '1', '3']);
    for (const seat of ['0', '1', '3'] as const) {
      expect(typeof map[seat]).toBe('function');
    }
  });

  it('1-player solo: human owns all four roles, bot map is empty', () => {
    const map = buildBotMap({ numPlayers: 1, humanRole: 'chief' });
    expect(Object.keys(map)).toEqual([]);
  });

  it('composed bot returns the first non-null move from owned roles', () => {
    // 2p solo, humanRole=chief → seat 1 holds domestic+defense.
    // The composed bot's iteration order is the role order recorded in
    // `assignRoles(2)['1']`, which is `['domestic', 'defense']`. With
    // seat 1 sitting in `defenseTurn`, domesticBot returns null
    // (wrong stage) and defenseBot supplies the candidate.
    const map = buildBotMap({ numPlayers: 2, humanRole: 'chief' });
    const seatBot = map['1'];
    expect(seatBot).toBeDefined();

    const G = setupG(2);

    const ctx = ctxFor('othersPhase', { '1': 'defenseTurn' }, 2);
    const action = seatBot!({ G, ctx, playerID: '1' });
    expect(action).not.toBeNull();
    // The first non-null candidate must come from defenseBot since
    // seat 1 is in defenseTurn, not domesticTurn.
    expect(action?.move).toBe('defenseSeatDone');
  });

  it.todo(
    'wires the bot map into the network-mode Client (server-side runBot in 10.9)',
  );
});
