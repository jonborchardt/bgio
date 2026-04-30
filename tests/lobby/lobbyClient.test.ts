// 10.3 — smoke tests for the shared LobbyClient instance.
//
// We deliberately don't re-test bgio's REST wiring here; the assertion is
// just that our singleton exposes the bgio methods we plan to call. The
// round-trip integration test (against a live `createServer()` instance)
// is left as `it.todo` — it lives more naturally in a server-test file
// and would duplicate boot harness from tests/server/boot.test.ts.

import { describe, expect, it } from 'vitest';
import { lobby } from '../../src/lobby/lobbyClient.ts';

describe('lobbyClient (10.3)', () => {
  it('exports a LobbyClient with the bgio REST methods', () => {
    // Functions, not just typeof === 'function' on `undefined`.
    expect(lobby).toBeDefined();
    for (const name of [
      'listGames',
      'listMatches',
      'getMatch',
      'createMatch',
      'joinMatch',
      'leaveMatch',
      'updatePlayer',
      'playAgain',
    ] as const) {
      expect(typeof (lobby as unknown as Record<string, unknown>)[name]).toBe(
        'function',
      );
    }
  });

  it.todo('round-trips createMatch -> listMatches against a live server');
});
