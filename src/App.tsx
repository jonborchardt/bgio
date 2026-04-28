import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { CircularProgress, Stack, Typography } from '@mui/material';
import { Client } from 'boardgame.io/react';
import { Settlement } from './game/index.ts';
import { SettlementBoard } from './Board.tsx';
import {
  detectMode,
  getServerURL,
  networkedClientFactory,
} from './clientMode.ts';
import { LobbyShell } from './lobby/LobbyShell.tsx';
import {
  clearCreds,
  loadCreds,
  saveCreds,
  type SessionCreds,
} from './lobby/credentials.ts';

/** The hot-seat client — single tab driving all seats. This is the GH Pages
 * default and the fallback whenever networked mode is selected but we don't
 * yet have lobby-provided match coordinates. */
const HotSeatApp = Client({
  game: Settlement,
  board: SettlementBoard,
  numPlayers: 4,
  debug: false,
});

/** Read `?matchID=...&playerID=...&credentials=...` from the page URL.
 *
 * This is the developer-bypass path that survived 10.3 — supplying the
 * three params directly skips the lobby. If any are missing we fall
 * through to the normal lobby / hot-seat flow. */
const readMatchFromQuery = (): {
  matchID: string;
  playerID: string;
  credentials: string;
} | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const matchID = params.get('matchID');
  const playerID = params.get('playerID');
  const credentials = params.get('credentials');
  if (!matchID || !playerID || !credentials) return null;
  return { matchID, playerID, credentials };
};

/** Networked-mode shell: at mount, decide between
 *   (a) restore from persisted creds (10.6 reconnect),
 *   (b) developer query-string override, or
 *   (c) show the LobbyShell.
 *
 * Once a match is picked we mount a freshly-built networked Client.
 * `useMemo` keys the factory on the (matchID, playerID, credentials)
 * triple so a second join in the same session rebuilds the Client. */
const NetworkedShell = () => {
  const [match, setMatch] = useState<
    | {
        matchID: string;
        /** null when watching as a spectator (10.8). */
        playerID: string | null;
        /** null when watching as a spectator (10.8). */
        credentials: string | null;
      }
    | null
  >(() => {
    // Run synchronously at first render: query-string override wins
    // (developer path), then persisted creds. We need this synchronous
    // to avoid a flash of the lobby UI when there's a valid session.
    const fromQuery = readMatchFromQuery();
    if (fromQuery) return fromQuery;
    const saved = loadCreds();
    if (saved) {
      return {
        matchID: saved.matchID,
        playerID: saved.playerID,
        credentials: saved.credentials,
      };
    }
    return null;
  });

  // 10.6 server-down spinner. V1 is intentionally minimal: when we have
  // creds but haven't mounted yet we just show "Connecting…". The plan
  // calls for a retry-with-backoff loop at intervals of 1s, 2s, 5s, 15s,
  // 30s, 60s with a manual "retry now" button — implementing that lives
  // alongside the real probe endpoint, which we haven't wired yet
  // (Settlement's GET /games/:name/:matchID is the bgio default; bolting
  // in fetch + AbortController + retry timers belongs in a follow-up).
  // The it.todo at the bottom of credentials.test.ts pins the work.
  const [connecting] = useState(false);

  const NetworkedApp = useMemo<ComponentType | null>(() => {
    if (!match) return null;
    return networkedClientFactory(
      match.matchID,
      match.playerID,
      match.credentials,
    );
  }, [match]);

  // When the lobby reports a successful join, persist + switch.
  // Spectator joins (10.8) come in with playerID === null and
  // credentials === null — we don't persist those (they're not a
  // committed seat) but still switch the view.
  const onSelect = (
    matchID: string,
    playerID: string | null,
    credentials: string | null,
  ) => {
    if (playerID !== null && credentials !== null) {
      saveCreds({
        matchID,
        playerID,
        credentials,
        serverUrl: getServerURL(),
      });
    }
    setMatch({ matchID, playerID, credentials });
  };

  // If the user clears their session (e.g. via a future "leave match"
  // button), we drop the persisted creds. Hooked here for symmetry with
  // saveCreds; no UI yet exposes it.
  useEffect(() => {
    if (match === null) {
      clearCreds();
    }
  }, [match]);

  if (NetworkedApp) {
    if (connecting) {
      return (
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Connecting…</Typography>
        </Stack>
      );
    }
    return <NetworkedApp />;
  }

  return <LobbyShell onSelect={onSelect} />;
};

const Networked: ComponentType = NetworkedShell;

/** Top-level App: pick networked vs hot-seat once at mount. The mode is
 * a build-time setting (`VITE_CLIENT_MODE`), so a re-evaluation on every
 * render would only burn CPU. */
const App: ComponentType = () => {
  const mode = detectMode();
  if (mode === 'networked') {
    return <Networked />;
  }
  // Hot-seat: legacy GH Pages path. The bgio React Client returns a
  // class component whose props are all optional in this mode.
  const HotSeat = HotSeatApp as unknown as ComponentType;
  return <HotSeat />;
};

export default App;

// `SessionCreds` is re-exported here only so consumers that import App
// can treat the session-shape as a public API surface. The real shape
// lives in `./lobby/credentials.ts`.
export type { SessionCreds };
