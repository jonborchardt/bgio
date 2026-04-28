import type { Game, Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

export interface CardSweepState {
  cards: (number | null)[];
  scores: Record<string, number>;
}

const shuffle = <T>(arr: readonly T[], rand: () => number): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const pickCard: Move<CardSweepState> = ({ G, ctx }, cardIdx: number) => {
  if (cardIdx < 0 || cardIdx >= G.cards.length) return INVALID_MOVE;
  const value = G.cards[cardIdx];
  if (value === null) return INVALID_MOVE;
  G.scores[ctx.currentPlayer] = (G.scores[ctx.currentPlayer] ?? 0) + value;
  G.cards[cardIdx] = null;
};

export const CardSweep: Game<CardSweepState> = {
  name: 'card-sweep',

  setup: ({ random }) => ({
    cards: shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], () => random.Number()),
    scores: { '0': 0, '1': 0 },
  }),

  turn: { minMoves: 1, maxMoves: 1 },

  moves: { pickCard },

  endIf: ({ G }) => {
    if (G.cards.every((c) => c === null)) {
      const p0 = G.scores['0'] ?? 0;
      const p1 = G.scores['1'] ?? 0;
      if (p0 > p1) return { winner: '0' };
      if (p1 > p0) return { winner: '1' };
      return { draw: true };
    }
  },
};
