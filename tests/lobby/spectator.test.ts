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

  it.todo(
    'a spectator Client receives state updates as moves are made on the server',
  );
  it.todo(
    'a spectator Client cannot dispatch moves (server rejects)',
  );
  it.todo(
    'playerView(G, ctx, null) redacts defense hand contents but keeps bank visible',
  );
  it.todo('spectator can leave and rejoin without affecting seat metadata');
});
