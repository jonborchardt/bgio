// 11.3 — ChiefBot tests.
//
// Pure heuristic; we drive it by calling `chiefBot.play({ G, ctx, playerID })`
// directly with hand-crafted state — no bgio Client needed. The tests pin
// down a few invariants:
//   - empty bank ⇒ chiefEndPhase
//   - 4-player game with demand on a non-chief seat ⇒ distributes toward
//     the seat with most demand
//   - 1-player game ⇒ no other seats, so chiefEndPhase
//   - determinism: same state, same action

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { chiefBot } from '../../src/game/ai/chiefBot.ts';
import { setup } from '../../src/game/setup.ts';
import type { SettlementState } from '../../src/game/types.ts';

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

  it('4-player: distributes gold to a non-chief seat with demand', () => {
    const G = setupG(4);
    G.bank.gold = 10;

    // Setup populates the domestic hand from BUILDINGS, so seat 2
    // (domestic) shows a non-zero `domesticDemandAt` straight from
    // `setup`. Seat 1 (science) and seat 3 (defense) have no built-in
    // gold demand in the 1.4 stub, so the chief bot should route to
    // seat 2.
    expect(G.domestic).toBeDefined();
    expect(G.domestic!.hand.length).toBeGreaterThan(0);

    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });

    expect(action).not.toBeNull();
    expect(action!.move).toBe('chiefDistribute');
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
    // Strip all demand: empty domestic hand and mark all science cards
    // completed.
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
