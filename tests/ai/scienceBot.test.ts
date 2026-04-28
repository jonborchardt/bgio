// 11.4 — ScienceBot tests.
//
// We use a 4-player layout so the science role lives on its own seat
// (seat '1') and that seat owns a wallet (chief seats don't get one).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { scienceBot } from '../../src/game/ai/scienceBot.ts';
import { setup } from '../../src/game/setup.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { RESOURCES } from '../../src/game/resources/types.ts';
import type { Resource } from '../../src/game/resources/types.ts';

const SEAT = '1'; // 4-player layout: seat 1 holds science.

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

const fillWallet = (
  G: SettlementState,
  seat: string,
  amounts: Partial<Record<Resource, number>>,
): void => {
  const wallet = G.wallets[seat];
  if (!wallet) throw new Error(`no wallet for seat ${seat}`);
  for (const r of RESOURCES) {
    if (amounts[r] !== undefined) wallet[r] = amounts[r] ?? 0;
  }
};

const sumCost = (card: { cost: Partial<Record<Resource, number>> }): number => {
  let total = 0;
  for (const r of RESOURCES) total += card.cost[r] ?? 0;
  return total;
};

describe('scienceBot (11.4)', () => {
  it('returns null when not in scienceTurn', () => {
    const G = setupG(4);
    const action = scienceBot.play({
      G,
      ctx: ctxFor('chiefPhase', undefined, 4),
      playerID: SEAT,
    });
    expect(action).toBeNull();
  });

  it('returns null when caller does not hold science role', () => {
    const G = setupG(4);
    // Seat 0 is chief; seat 0 calling with scienceTurn should bail.
    const action = scienceBot.play({
      G,
      ctx: ctxFor('othersPhase', { '0': 'scienceTurn' }, 4),
      playerID: '0',
    });
    expect(action).toBeNull();
  });

  it('completes a paid-off card when one is reachable and per-round limit allows', () => {
    const G = setupG(4);
    const science = G.science!;
    // Pick the lowest-level card in the first column and pre-fill its
    // paid ledger to its cost.
    const card = science.grid[0]![0]!;
    const paid = science.paid[card.id]!;
    for (const r of RESOURCES) {
      paid[r] = card.cost[r] ?? 0;
    }
    const action = scienceBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'scienceTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).toEqual({ move: 'scienceComplete', args: [card.id] });
  });

  it('skips completion when perRoundCompletions has hit the cap', () => {
    const G = setupG(4);
    const science = G.science!;
    science.perRoundCompletions = 1;
    // Pre-fill a card so it would be completable, but since the cap hit
    // the bot should fall through to contribute (or null).
    const card = science.grid[0]![0]!;
    for (const r of RESOURCES) {
      science.paid[card.id]![r] = card.cost[r] ?? 0;
    }
    // Wallet has no resources → bot should return null.
    const action = scienceBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'scienceTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).toBeNull();
  });

  it('contributes 1 of a resource to the cheapest reachable card when wallet has it', () => {
    const G = setupG(4);
    const science = G.science!;

    // Wallet: give the seat 5 of every basic. Pick the cheapest reachable
    // card across columns so we can predict the bot's choice.
    fillWallet(G, SEAT, {
      gold: 5,
      wood: 5,
      stone: 5,
      steel: 5,
      horse: 5,
      food: 5,
      production: 5,
      science: 5,
    });

    const reachable = science.grid.map((col) => col[0]!);
    // smallest remaining cost; tie-break by id
    let cheapest = reachable[0]!;
    let cheapestSum = sumCost(cheapest);
    for (const c of reachable) {
      const s = sumCost(c);
      if (s < cheapestSum || (s === cheapestSum && c.id.localeCompare(cheapest.id) < 0)) {
        cheapest = c;
        cheapestSum = s;
      }
    }

    const action = scienceBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'scienceTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).not.toBeNull();
    expect(action!.move).toBe('scienceContribute');
    expect(action!.args[0]).toBe(cheapest.id);
    const amount = action!.args[1] as Partial<Record<Resource, number>>;
    // exactly one resource set to 1
    const entries = Object.entries(amount).filter(([, v]) => (v ?? 0) > 0);
    expect(entries.length).toBe(1);
    expect(entries[0]![1]).toBe(1);
  });

  it('returns null when no card needs anything the wallet has', () => {
    const G = setupG(4);
    // Wallet empty by default.
    const action = scienceBot.play({
      G,
      ctx: ctxFor('othersPhase', { [SEAT]: 'scienceTurn' }, 4),
      playerID: SEAT,
    });
    expect(action).toBeNull();
  });

  it('determinism: same state produces same action', () => {
    const G = setupG(4);
    fillWallet(G, SEAT, {
      wood: 5,
      stone: 5,
      food: 5,
      production: 5,
      gold: 5,
      horse: 5,
      steel: 5,
    });
    const ctx = ctxFor('othersPhase', { [SEAT]: 'scienceTurn' }, 4);
    const a = scienceBot.play({ G, ctx, playerID: SEAT });
    const b = scienceBot.play({ G, ctx, playerID: SEAT });
    expect(a).toEqual(b);
  });
});
