// 10.8 — spectator client smoke tests.
//
// We verify the module surface only — `joinAsSpectator` is a thin wrapper
// over bgio's React `Client` factory. Behaviour-level tests (state
// updates round-trip, dispatched moves are rejected by the server) live
// behind `it.todo`s because:
//   1. They require a live server + websocket transport, and bgio's
//      `Client` factory expects a DOM mount to fully boot.
//   2. `@testing-library/react` isn't installed in this slice, so we
//      can't render the wrapped Client into a jsdom container without
//      adding a dep.

import { describe, expect, it } from 'vitest';
import { joinAsSpectator } from '../../src/lobby/spectatorClient.ts';

describe('spectatorClient (10.8)', () => {
  it('exports a joinAsSpectator factory that returns a component', () => {
    const Spectator = joinAsSpectator(
      'http://localhost:8000',
      'match-xyz',
      'fake-token',
    );
    // Bgio wraps the rendered component as a React function component.
    expect(typeof Spectator).toBe('function');
  });

  it('factory accepts the documented (serverUrl, matchID, authToken) shape', () => {
    // Smoke: the call must not throw at construction time. Behaviour
    // (websocket connect, state subscription) needs a live server —
    // covered by integration tests in a future slice.
    expect(() =>
      joinAsSpectator('http://localhost:8000', 'm1', 't1'),
    ).not.toThrow();
  });

});

describe('spectator behaviour (10.8 — pinned at the seam)', () => {
  it('playerView(G, ctx, null) redacts defense hand contents but keeps bank visible', async () => {
    const { playerViewFor } = await import('../../src/game/playerView.ts');
    const { assignRoles } = await import('../../src/game/roles.ts');
    const { initialBank } = await import('../../src/game/resources/bank.ts');
    const G = {
      bank: initialBank(),
      roleAssignments: assignRoles(2),
      round: 1,
      bossResolved: false,
      mats: {},
      hands: {
        '0': { domestic: ['A', 'B'] },
        '1': { defense: ['x', 'y', 'z'] },
      },
    } as unknown as Parameters<typeof playerViewFor>[0];

    const view = playerViewFor(G, {} as Parameters<typeof playerViewFor>[1], null);
    // Defense hand on seat 1 is redacted (length kept, contents nulled).
    const seat1 = view.hands['1'] as { defense: unknown[] };
    expect(seat1.defense).toEqual([null, null, null]);
    // Bank stays public.
    expect(view.bank).toEqual(G.bank);
  });

  it('authenticateCredentials rejects a move attempted from a spectator-shaped seat (no creds, no isBot)', async () => {
    const { authenticateCredentials } = await import(
      '../../server/auth/authenticateCredentials.ts'
    );
    // A seat whose stored credentials exist (a real human is in seat 0)
    // must not accept a move with the wrong/empty credential — that's
    // the impersonation case the auth hook gates on.
    const meta = { id: 0, credentials: 'real-token' };
    expect(authenticateCredentials('', meta)).toBe(false);
    expect(authenticateCredentials(undefined, meta)).toBe(false);
    expect(authenticateCredentials('wrong-token', meta)).toBe(false);
    // The legitimate human can still move.
    expect(authenticateCredentials('real-token', meta)).toBe(true);
  });

  // Deferred: spectator state-update round-trip and leave/rejoin
  // metadata persistence both require a live SocketIO connection.
  // The end-to-end Playwright spec under tests-e2e/ is the right
  // place; vitest jsdom doesn't carry a websocket polyfill.
});
