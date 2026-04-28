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

  // `seed` is forwarded as a top-level option; bgio's `Client` accepts it
  // when present and ignores it otherwise. 02.3 wires the random plugin
  // properly so tests can rely on it being deterministic.
  const client = Client<SettlementState>({
    game: Settlement,
    numPlayers,
    playerID,
    // Cast keeps the option opt-in without depending on bgio's published
    // option-shape changing across patch versions.
    ...({ seed } as { seed?: string }),
  });

  client.start();

  return client;
};
