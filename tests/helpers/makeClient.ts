// Headless test client factory.
//
// Wraps `Client` from `boardgame.io/client` with sensible defaults so every
// test in this repo opens the same way. Later stages (02.3) will plumb the
// `seed` into bgio's random plugin properly; for now we forward whatever
// `Client` natively accepts.

import { Client } from 'boardgame.io/client';
import { Settlement } from '../../src/game/index.ts';
import type { SettlementState } from '../../src/game/types.ts';

export interface MakeClientOptions {
  numPlayers?: 1 | 2 | 3 | 4; // default 2
  seed?: string; // default 'test-seed'
  playerID?: string; // for spectator-style state inspection
}

// We let TypeScript infer the client return type rather than importing
// `boardgame.io/dist/types/src/client/client` directly — that internal path
// is not part of the package's public surface and may shift between versions.
export type TestClient = ReturnType<typeof Client<SettlementState>>;

export const makeClient = (opts: MakeClientOptions = {}): TestClient => {
  const { numPlayers = 2, seed = 'test-seed', playerID } = opts;

  // bgio's Random plugin reads `Game.seed` for setup-time determinism. We
  // splice the per-test seed onto a shallow copy of `Settlement` so two
  // clients launched with the same seed produce structurally identical state
  // (including any setup-time shuffles, e.g. 05.1's science grid).
  const seededGame = { ...Settlement, seed } as typeof Settlement;

  const client = Client<SettlementState>({
    game: seededGame,
    numPlayers,
    playerID,
  });

  client.start();

  return client;
};
