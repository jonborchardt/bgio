// Client transport mode selection.
//
// Two modes:
//   - 'hotseat'   — bgio's default `Local` transport, all seats from one tab.
//                   The GH Pages build ships in this mode.
//   - 'networked' — bgio's `SocketIO` transport pointed at the bgio server
//                   from `server/index.ts`. Opt-in at build time via env.
//
// `App.tsx` calls `detectMode()` at module load. Anything stronger (per-room
// switching, runtime toggles) belongs in 10.3 lobby work, not here.

import { createElement, type ComponentType } from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Settlement } from './game/index.ts';
import { SettlementBoard } from './Board.tsx';

export type ClientMode = 'hotseat' | 'networked';

/** Read a Vite-injected env var, tolerating environments where
 * `import.meta.env` is undefined (e.g. headless tests that don't run
 * through the Vite plugin). We also fall back to `process.env` so
 * `vi.stubEnv` works in unit tests — Vitest stubs both, but accessing
 * `import.meta.env` via dynamic key reads through the proxy in some
 * setups while a static read might be inlined at transform time. */
const readEnv = (key: string): string | undefined => {
  // The cast through `unknown` keeps `verbatimModuleSyntax` + strict TS happy
  // without forcing a `vite/client` reference into headless test runs.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env;
  const fromImport = env ? env[key] : undefined;
  if (fromImport !== undefined && fromImport !== '') return fromImport;
  if (typeof process !== 'undefined' && process.env) {
    const fromProcess = process.env[key];
    if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
  }
  return undefined;
};

/** Detect the build-time client mode. Defaults to hot-seat so the existing
 * GH Pages deployment keeps working with no env config. */
export const detectMode = (): ClientMode => {
  const raw = readEnv('VITE_CLIENT_MODE');
  if (raw === 'networked') return 'networked';
  return 'hotseat';
};

/** URL of the bgio server. Used by the networked client to find sockets and
 * (eventually) lobby REST endpoints. */
export const getServerURL = (): string => {
  return readEnv('VITE_SERVER_URL') ?? 'http://localhost:8000';
};

/** Construct a networked bgio React client wired to a specific match.
 *
 * The lobby flow (10.3) is responsible for sourcing matchID / playerID /
 * credentials and passing them in. We deliberately don't read them from
 * env here — multiple matches per build is the whole point of networked
 * mode.
 *
 * Note: bgio's React `Client` factory doesn't accept matchID/playerID/
 * credentials directly — those land on the rendered component as props.
 * We wrap the factory output in a no-arg component that passes them in
 * so callers get a drop-in replacement for `HotSeatApp` (also a
 * no-arg-component). */
export const networkedClientFactory = (
  matchID: string,
  playerID: string | null,
  credentials: string | null,
): ComponentType => {
  // Cast to ComponentType<Record<string, unknown>>: bgio types the rendered
  // component's props as `_ClientOpts`, which includes matchID/playerID/
  // credentials but isn't exported as a named type.
  const NetworkedClient = Client({
    game: Settlement,
    board: SettlementBoard,
    numPlayers: 4,
    multiplayer: SocketIO({ server: getServerURL() }),
    debug: false,
  }) as unknown as ComponentType<{
    matchID?: string;
    playerID?: string | null;
    credentials?: string;
  }>;

  // Spectator path (10.8): playerID null + credentials null. bgio's
  // `playerView(G, ctx, null)` already redacts secret state for the
  // null spectator; the Client just needs the matchID. We pass
  // `playerID: null` explicitly so bgio routes the connection as a
  // spectator and not as the implicit "first available seat".
  const props: { matchID: string; playerID?: string | null; credentials?: string } = {
    matchID,
  };
  if (playerID !== null) props.playerID = playerID;
  else props.playerID = null;
  if (credentials !== null) props.credentials = credentials;

  const Wrapped: ComponentType = () => createElement(NetworkedClient, props);
  Wrapped.displayName = 'NetworkedSettlementClient';
  return Wrapped;
};
