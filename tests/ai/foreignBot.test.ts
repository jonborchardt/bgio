// 11.6 — ForeignBot tests.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { foreignBot } from '../../src/game/ai/foreignBot.ts';
import { setup } from '../../src/game/setup.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { UNITS } from '../../src/data/index.ts';

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

const SEAT = '3'; // 4-player layout: seat 3 holds foreign.

describe('foreignBot (11.6)', () => {
  it('returns null when not in foreignTurn or foreignAwaitingDamage', () => {
    const G = setupG(4);
    const action = foreignBot.play({
      G,
      ctx: ctxFor('chiefPhase', undefined, 4),
      playerID: SEAT,
    });
    expect(action).toBeNull();
  });

  it('returns null when caller does not hold foreign role', () => {
    const G = setupG(4);
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { '0': 'foreignTurn' }, 4),
      playerID: '0',
    });
    expect(action).toBeNull();
  });

  it('pays upkeep first when wallet can cover the bill', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    foreign.inPlay = [{ defID: 'Scout', count: 1 }]; // upkeep = 2 gold
    foreign._upkeepPaid = false;
    G.wallets[SEAT]!.gold = 10;
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).toEqual({ move: 'foreignUpkeep', args: [] });
  });

  it('releases the cheapest unit when wallet < upkeep', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    // Two units in play; the cheapest is Scout (cost 2).
    foreign.inPlay = [
      { defID: 'Brute', count: 1 }, // cost 3
      { defID: 'Scout', count: 1 }, // cost 2
    ];
    foreign._upkeepPaid = false;
    G.wallets[SEAT]!.gold = 0; // can't cover anything
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).not.toBeNull();
    expect(action!.move).toBe('foreignReleaseUnit');
    expect(action!.args[0]).toBe('Scout');
  });

  it('recruits the cheapest hand unit when upkeep is paid and wallet allows', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    foreign._upkeepPaid = true;
    G.wallets[SEAT]!.gold = 10;
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).not.toBeNull();
    expect(action!.move).toBe('foreignRecruit');
    // Cheapest in default hand is Scout (cost 2).
    expect(action!.args[0]).toBe('Scout');
    expect(action!.args[1]).toBe(1);
  });

  it('flips a battle when the resolver predicts a win', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    foreign._upkeepPaid = true;
    foreign.hand = []; // skip recruit step (no hand)
    // Strong roster vs. weak top-of-deck (which is number=1 — typically
    // a single Scout/Archer/Brute per cards 1-4).
    foreign.inPlay = [{ defID: 'Bazooka', count: 4 }];
    G.wallets[SEAT]!.gold = 0;
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).not.toBeNull();
    // Either flips the battle (predicted win) or returns null (no
    // win predicted). Given a Bazooka stack vs. number-1 deck cards,
    // the predicted outcome should be a win.
    expect(action!.move).toBe('foreignFlipBattle');
  });

  it('does not flip when last battle was a loss', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    foreign._upkeepPaid = true;
    foreign.hand = [];
    foreign.inPlay = [{ defID: 'Bazooka', count: 4 }];
    foreign.lastBattleOutcome = 'lose';
    G.wallets[SEAT]!.gold = 0;
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4),
      playerID: SEAT,
    });
    // Loss → no flip; bot should return null (no other actions left).
    expect(action).toBeNull();
  });

  it('flips a trade after a winning battle', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    foreign._upkeepPaid = true;
    foreign.hand = [];
    foreign.inPlay = [];
    foreign.battleDeck = []; // skip battle flip
    foreign.lastBattleOutcome = 'win';
    G.wallets[SEAT]!.gold = 0;
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).not.toBeNull();
    expect(action!.move).toBe('foreignFlipTrade');
  });

  it('returns null when nothing to do', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    foreign._upkeepPaid = true;
    foreign.hand = [];
    foreign.inPlay = [];
    foreign.battleDeck = [];
    foreign.tradeDeck = [];
    G.wallets[SEAT]!.gold = 0;
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).toBeNull();
  });

  it('responds to foreignAwaitingDamage by returning an assignDamage candidate', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    // Synthesize a battle in flight: a tiny enemy (Scout) and a tiny
    // committed roster (Spearman) so the resolver has well-defined HP.
    foreign.inFlight = {
      battle: {
        id: 'bat-test',
        number: 1,
        units: [{ name: 'Scout', count: 1 }],
        reward: { gold: 1 },
      },
      committed: [{ defID: 'Spearman', count: 1 }],
    };
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignAwaitingDamage' }, 4),
      playerID: SEAT,
    });
    expect(action).not.toBeNull();
    expect(action!.move).toBe('foreignAssignDamage');
    const allocations = action!.args[0] as Array<{ byUnit: Record<string, number> }>;
    expect(Array.isArray(allocations)).toBe(true);
    // The plan should put damage on the lowest-HP committed unit. We
    // only have Spearman committed, so the plan must mention Spearman.
    expect(allocations.length).toBeGreaterThan(0);
    expect(Object.keys(allocations[0]!.byUnit)).toContain('Spearman');
  });

  it('determinism: same state produces same action', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    foreign._upkeepPaid = true;
    G.wallets[SEAT]!.gold = 10;
    const ctx = ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4);
    const a = foreignBot.play({ G, ctx, playerID: SEAT });
    const b = foreignBot.play({ G, ctx, playerID: SEAT });
    expect(a).toEqual(b);
  });

  it('does not invent unit names — recruited name is in the hand', () => {
    const G = setupG(4);
    const foreign = G.foreign!;
    foreign._upkeepPaid = true;
    G.wallets[SEAT]!.gold = 100;
    const action = foreignBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'foreignTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).not.toBeNull();
    expect(action!.move).toBe('foreignRecruit');
    const name = action!.args[0] as string;
    const inHand = foreign.hand.some((u) => u.name === name);
    const inUnits = UNITS.some((u) => u.name === name);
    expect(inHand).toBe(true);
    expect(inUnits).toBe(true);
  });
});
