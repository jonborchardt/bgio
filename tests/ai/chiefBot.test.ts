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
    // Defense redesign 2.3: the bot must flip the track first; once
    // the flip latch is set, the next call returns chiefEndPhase.
    if (G.track !== undefined) G.track.flippedThisRound = true;
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
    if (G.track !== undefined) G.track.flippedThisRound = true;
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

  it('issue 036 — picks chiefTax when bank is low and a non-chief seat has hoarded a haul', () => {
    const G = setupG(4);
    // Bank gold below the threshold (4) so we drop into the tax path.
    G.bank.gold = 1;
    // Domestic seat (2) has a fat stash. Per stash-haul math:
    // floor(stash / 2) summed across resources >= TAX_MIN_HAUL_THRESHOLD (3).
    if (G.mats?.['2']) {
      G.mats['2']!.stash = {
        ...G.mats['2']!.stash,
        gold: 6, // floor(6/2) = 3 → meets the haul threshold
      };
    }
    expect(G.chief?.taxedThisRound).toBeFalsy();
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });
    expect(action).toEqual({ move: 'chiefTax', args: [] });
  });

  it('issue 036 — does NOT pick tax once already taxed this round', () => {
    const G = setupG(4);
    G.bank.gold = 1;
    if (G.mats?.['2']) {
      G.mats['2']!.stash = { ...G.mats['2']!.stash, gold: 6 };
    }
    if (G.chief) G.chief.taxedThisRound = true;
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });
    // Bank is empty-ish (≤ 0 after the bot would distribute), so we
    // either flip or end. Either way, NOT chiefTax.
    expect(action?.move).not.toBe('chiefTax');
  });

  it('ends phase when no other seat shows demand (empty roles state)', () => {
    const G = setupG(4);
    G.bank.gold = 7;
    if (G.domestic !== undefined) G.domestic.hand = [];
    if (G.library !== undefined) {
      G.library.row = [null, null, null, null, null, null];
    }
    if (G.track !== undefined) G.track.flippedThisRound = true;
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });
    expect(action).toEqual({ move: 'chiefEndPhase', args: [] });
  });

  it('flips the track when not yet flipped this round and ready to end phase', () => {
    // Defense redesign 2.3 (D22): chief must flip the track before
    // ending phase. With no demand and no flip yet, the bot returns
    // chiefFlipTrack rather than chiefEndPhase.
    const G = setupG(4);
    G.bank.gold = 0; // nothing to distribute
    // Track was populated by setup; flippedThisRound starts undefined.
    expect(G.track?.flippedThisRound).not.toBe(true);
    const action = chiefBot.play({
      G,
      ctx: ctxFor('chiefPhase', 4),
      playerID: '0',
    });
    expect(action).toEqual({ move: 'chiefFlipTrack', args: [] });
  });
});
