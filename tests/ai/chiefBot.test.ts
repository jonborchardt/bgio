// 11.3 — ChiefBot tests.
//
// Pure heuristic; we drive it by calling `chiefBot.play({ G, ctx, playerID })`
// directly with hand-crafted state — no bgio Client needed. The tests pin
// down a few invariants:
//   - empty bank ⇒ chiefEndPhase
//   - 4-player game with demand on multiple seats ⇒ distributes toward the
//     seat with most demand
//   - 1-player game ⇒ no other seats, so chiefEndPhase
//   - determinism: same state, same action

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { chiefBot } from '../../src/game/ai/chiefBot.ts';
import { setup } from '../../src/game/setup.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { UNITS } from '../../src/data/index.ts';

const ctxFor = (phase: string, numPlayers = 4): Ctx =>
  ({
    phase,
    activePlayers: undefined,
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

describe('chiefBot (11.3)', () => {
  it('returns null when not in chiefPhase', () => {
    const G = setupG(4);
    const action = chiefBot.play({
      G,
      ctx: ctxFor('othersPhase', 4),
      playerID: '0',
    });
    expect(action).toBeNull();
  });

  it('returns null when caller is not the chief seat', () => {
    const G = setupG(4);
    // In 4-player layout seat 0 is chief; seat 1 calls in.
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '1',
    });
    expect(action).toBeNull();
  });

  it('ends phase when the bank gold is empty', () => {
    const G = setupG(4);
    G.bank.gold = 0;
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });
    expect(action).toEqual({ move: 'chiefEndPhase', args: [] });
  });

  it('1-player game: chief is also every other role, no other seats — ends phase', () => {
    const G = setupG(1);
    G.bank.gold = 5;
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 1),
      playerID: '0',
    });
    expect(action).toEqual({ move: 'chiefEndPhase', args: [] });
  });

  it('resolves a parked trade-discard with `new`', () => {
    const G = setupG(4);
    G._awaitingChiefTradeDiscard = true;
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });
    expect(action).toEqual({
      move: 'chiefDecideTradeDiscard',
      args: ['new'],
    });
  });

  it('4-player: distributes gold to the seat with most demand', () => {
    const G = setupG(4);
    G.bank.gold = 10;

    // Set up demand: seat 3 (foreign) holds the most expensive in-play
    // unit, so foreignDemand dominates. Seat 1 (science) has untouched
    // beginner cards (some demand), seat 2 (domestic) has a hand of
    // buildings (some demand).
    if (G.foreign === undefined) throw new Error('foreign slice missing');
    // Pick the most expensive unit so the foreign seat's demand is large.
    const expensive = [...UNITS]
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 1)
      .map((u) => ({ defID: u.name, count: 3 }));
    G.foreign.inPlay = expensive;

    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });

    // We expect chiefDistribute toward seat '3' (the foreign seat in 4p).
    expect(action).not.toBeNull();
    expect(action!.move).toBe('chiefDistribute');
    const targetSeat = action!.args[0] as string;
    expect(targetSeat).toBe('3');
    const amounts = action!.args[1] as { gold?: number };
    expect(amounts.gold).toBe(1);
  });

  it('determinism: same state produces same action across calls', () => {
    const G = setupG(4);
    G.bank.gold = 5;
    const ctx = ctxFor('chiefPhase', 4);
    const a = chiefBot.play({ G, ctx, playerID: '0' });
    const b = chiefBot.play({ G, ctx, playerID: '0' });
    expect(a).toEqual(b);
  });

  it('ends phase when no other seat shows demand (empty roles state)', () => {
    const G = setupG(4);
    G.bank.gold = 7;
    // Strip all demand: clear inPlay, empty domestic hand, mark all
    // science cards completed.
    if (G.foreign !== undefined) G.foreign.inPlay = [];
    if (G.domestic !== undefined) G.domestic.hand = [];
    if (G.science !== undefined) {
      G.science.completed = G.science.grid.flat().map((c) => c.id);
    }
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });
    expect(action).toEqual({ move: 'chiefEndPhase', args: [] });
  });
});
