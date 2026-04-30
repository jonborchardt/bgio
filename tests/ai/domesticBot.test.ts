// 11.5 — DomesticBot tests.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { domesticBot } from '../../src/game/ai/domesticBot.ts';
import { setup } from '../../src/game/setup.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { BUILDINGS } from '../../src/data/index.ts';

const ctxFor = (
  phase: string,
  activePlayers?: Record<string, string>,
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

const setupG = (numPlayers: 1 | 2 | 3 | 4 = 4): SettlementState => {
  const ctx = { numPlayers } as unknown as Parameters<typeof setup>[0]['ctx'];
  return setup({ ctx });
};

describe('domesticBot (11.5)', () => {
  it('returns null when not in domesticTurn', () => {
    const G = setupG(4);
    const action = domesticBot.play({
      G,
      ctx: ctxFor('chiefPhase', undefined, 4),
      playerID: '2',
    });
    expect(action).toBeNull();
  });

  it('returns null when caller does not hold domestic role', () => {
    const G = setupG(4);
    // 4-player layout: seat 2 is domestic. seat 0 (chief) calling with
    // domesticTurn stage should bail.
    const action = domesticBot.play({
      G,
      ctx: ctxFor('othersPhase', { '0': 'domesticTurn' }, 4),
      playerID: '0',
    });
    expect(action).toBeNull();
  });

  it('does not call produce — auto-produce in othersPhase.turn.onBegin owns it', () => {
    const G = setupG(4);
    G.domestic!.grid['0,0'] = {
      defID: 'Granary',
      upgrades: 0,
      worker: null,
    };
    G.domestic!.producedThisRound = false;
    // Empty wallet → no buy is possible either. Bot should return null
    // rather than dispatching domesticProduce.
    const action = domesticBot.play({
      G,
      ctx: ctxFor('othersPhase', { '2': 'domesticTurn' }, 4),
      playerID: '2',
    });
    expect(action).toBeNull();
  });

  it('returns null when nothing is affordable', () => {
    const G = setupG(4);
    // Empty grid, empty wallet → no produce (empty grid), no buy.
    const action = domesticBot.play({
      G,
      ctx: ctxFor('othersPhase', { '2': 'domesticTurn' }, 4),
      playerID: '2',
    });
    expect(action).toBeNull();
  });

  it('buys the cheapest affordable building when something fits', () => {
    const G = setupG(4);
    // Wallet covers the cheapest: Granary at 10 gold.
    G.mats['2']!.stash.gold = 10;
    const action = domesticBot.play({
      G,
      ctx: ctxFor('othersPhase', { '2': 'domesticTurn' }, 4),
      playerID: '2',
    });
    expect(action).not.toBeNull();
    expect(action!.move).toBe('domesticBuyBuilding');
    const [name, x, y] = action!.args as [string, number, number];
    expect(name).toBe('Granary');
    // Empty grid → first placement at origin.
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('prefers a placement cell that triggers an adjacency bonus', () => {
    const G = setupG(4);

    // Pre-place a Granary at (0,0). Mill placed adjacent to Granary
    // earns +1 food via the canonical adjacency rule.
    G.domestic!.grid['0,0'] = {
      defID: 'Granary',
      upgrades: 0,
      worker: null,
    };
    G.domestic!.producedThisRound = true; // skip the produce branch

    // Make sure the seat's hand has Mill (it should, since BUILDINGS
    // contains Mill — setupDomestic copies all of them in).
    const hasMill = G.domestic!.hand.some((b) => b.name === 'Mill');
    expect(hasMill).toBe(true);

    // Wallet covers Mill (cost 13). Plus a sprinkle so we can also
    // afford something cheaper like Granary again — but Mill is the
    // one that nets a bonus.
    G.mats['2']!.stash.gold = 13;

    // Strip the hand down to just Mill so the cheapest-first sort
    // doesn't pick a different building. (Granary is cheaper, but
    // there's only one Mill rule to fire — keeping Mill in the hand
    // alone makes the test focused.)
    G.domestic!.hand = G.domestic!.hand.filter((b) => b.name === 'Mill');
    expect(G.domestic!.hand.length).toBe(1);

    const action = domesticBot.play({
      G,
      ctx: ctxFor('othersPhase', { '2': 'domesticTurn' }, 4),
      playerID: '2',
    });
    expect(action).not.toBeNull();
    expect(action!.move).toBe('domesticBuyBuilding');
    const [name, x, y] = action!.args as [string, number, number];
    expect(name).toBe('Mill');
    // Mill should be placed in a cell orthogonally adjacent to (0,0)
    // (the Granary). Any of (1,0), (-1,0), (0,1), (0,-1) qualifies.
    const dist = Math.abs(x - 0) + Math.abs(y - 0);
    expect(dist).toBe(1);
  });

  it('determinism: same state produces same action', () => {
    const G = setupG(4);
    G.mats['2']!.stash.gold = 50;
    const ctx = ctxFor('othersPhase', { '2': 'domesticTurn' }, 4);
    const a = domesticBot.play({ G, ctx, playerID: '2' });
    const b = domesticBot.play({ G, ctx, playerID: '2' });
    expect(a).toEqual(b);
  });

  it('does not hand-roll a building name not in the hand', () => {
    const G = setupG(4);
    G.mats['2']!.stash.gold = 1000;
    const action = domesticBot.play({
      G,
      ctx: ctxFor('othersPhase', { '2': 'domesticTurn' }, 4),
      playerID: '2',
    });
    expect(action).not.toBeNull();
    const name = action!.args[0] as string;
    const handHas = G.domestic!.hand.some((b) => b.name === name);
    const validBuilding = BUILDINGS.some((b) => b.name === name);
    expect(handHas).toBe(true);
    expect(validBuilding).toBe(true);
  });
});
