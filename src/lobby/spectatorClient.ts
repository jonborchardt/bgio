// 10.8 — spectator client factory.
//
// A spectator is "logged-in user, watching a match in progress, no seat".
// On the wire, this is bgio's standard `playerID === null` connection: bgio
// already runs `playerView(G, ctx, null)` for null connections (02.4 ships
// the redactor) and refuses to dispatch moves from such a connection.
// We don't add any custom transport — just construct a `Client` without
// a `playerID` and let bgio do the work.
//
// The `authToken` parameter isn't currently passed to bgio's transport
// (the SocketIO transport doesn't surface a per-connection header
// hook); it's accepted here to match the public API in 10.8 and to
// future-proof when a server-side spectator-gate (10.7 auth) is wired
// onto the websocket handshake. Using it solely as documentation is
// fine for V1 — TypeScript still validates the call site.

import { createElement, type ComponentType } from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Settlement } from '../game/index.ts';
import { SettlementBoard } from '../Board.tsx';

/** Construct a spectator-mode `Client` for `matchID` against `serverUrl`.
 *
 * Returns a no-arg React component (the same shape as the seat client
 * factory in `clientMode.ts`), so callers can swap between seat and
 * spectator clients without restructuring App.tsx.
 *
 * @param serverUrl Bgio server URL — usually the same as `getServerURL()`.
 * @param matchID The match to watch.
 * @param authToken Reserved for the future server-side spectator gate
 *                  (see file header). Not yet sent on the wire.
 */
export const joinAsSpectator = (
  serverUrl: string,
  matchID: string,
  _authToken: string,
): ComponentType => {
  // bgio's React `Client` factory accepts a `multiplayer` transport.
  // We point it at the spectator-friendly server. The rendered
  // component takes `matchID` + `playerID: null` as props — bgio's
  // typed surface for these props isn't exported as a named type, so
  // we cast the rendered component shape to a narrow local interface.
  const SpectatorClient = Client({
    game: Settlement,
    board: SettlementBoard,
    numPlayers: 4,
    multiplayer: SocketIO({ server: serverUrl }),
    debug: false,
  }) as unknown as ComponentType<{
    matchID?: string;
    playerID?: string | null;
  }>;

  const Wrapped: ComponentType = () =>
    createElement(SpectatorClient, { matchID, playerID: null });
  Wrapped.displayName = 'SettlementSpectatorClient';
  return Wrapped;
};

export default joinAsSpectator;
