import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { CardSweep } from '../src/game.ts';

describe('CardSweep', () => {
  it('initializes nine non-null cards summing to 45', () => {
    const client = Client({ game: CardSweep });
    const { G } = client.getState()!;
    expect(G.cards).toHaveLength(9);
    expect(G.cards.every((c) => typeof c === 'number')).toBe(true);
    expect(G.cards.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)).toBe(45);
    expect(G.scores).toEqual({ '0': 0, '1': 0 });
  });

  it('awards a picked card to the current player and rejects re-picks', () => {
    const client = Client({ game: CardSweep });
    const before = client.getState()!.G.cards[0]!;

    client.moves.pickCard(0);
    let state = client.getState()!;
    expect(state.G.cards[0]).toBeNull();
    expect(state.G.scores['0']).toBe(before);

    client.moves.pickCard(0);
    state = client.getState()!;
    expect(state.G.scores['1'] ?? 0).toBe(0);
  });

  it('ends with a winner once every card is taken', () => {
    const client = Client({ game: CardSweep });
    for (let i = 0; i < 9; i++) client.moves.pickCard(i);
    const { ctx, G } = client.getState()!;
    expect(ctx.gameover).toBeDefined();
    const total = (G.scores['0'] ?? 0) + (G.scores['1'] ?? 0);
    expect(total).toBe(45);
  });
});
