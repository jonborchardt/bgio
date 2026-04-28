import { expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Settlement } from '../src/game/index.ts';

it('boots a 2-player headless client with role assignments', () => {
  const client = Client({ game: Settlement, numPlayers: 2 });
  const state = client.getState()!;
  expect(state.G.roleAssignments).toEqual({
    '0': ['chief', 'science'],
    '1': ['domestic', 'foreign'],
  });
});

it('pass advances the current player', () => {
  const client = Client({ game: Settlement, numPlayers: 2 });
  expect(client.getState()!.ctx.currentPlayer).toBe('0');
  client.moves.pass();
  expect(client.getState()!.ctx.currentPlayer).toBe('1');
});
