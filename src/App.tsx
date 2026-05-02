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
import { SeatPickerContext } from './ui/layout/SeatPickerContext.ts';
import { CardInfoProvider } from './ui/cards/CardInfoContext.tsx';
import { CardPreviewPage } from './ui/cardPreview/CardPreviewPage.tsx';
import type { PlayerID } from './game/index.ts';

/** Whether to show bgio's built-in Debug panel (12.2).
 *
 * bgio's React `Client` ships with a slide-out debug panel — turning it on
 * in dev gives developers access to the move log, RNG state, and a
 * "set state" affordance with no extra code from us. Production builds
 * keep it disabled so end users don't see it.
 *
 * `import.meta.env.DEV` is Vite's standard build-mode flag (true in
 * `vite dev`, false in `vite build`). We read it through `unknown` so a
 * headless test harness that doesn't preprocess `import.meta` (e.g. raw
 * Node) tolerates the access — Vitest sets it to `true` under `jsdom`,
 * which is what we want for in-test rendering. */
const debugEnabled: boolean =
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

/** When the debug panel is enabled, start it collapsed so it doesn't cover
 * the board on every load. The `.` key (bgio's debug toggle) still opens it. */
const debugOpt: { collapseOnLoad: true } | false = debugEnabled
  ? { collapseOnLoad: true }
  : false;

/** The hot-seat client — single tab driving all seats. This is the GH Pages
 * default and the fallback whenever networked mode is selected but we don't
 * yet have lobby-provided match coordinates.
 *
 * 14.1: the actual seat the user is driving is controlled at runtime by
 * the `playerID` prop on the rendered component (bgio's React Client
 * calls `client.updatePlayerID()` whenever that prop changes). The
 * `<HotSeatShell>` wrapper below seeds it to `'0'` on first render so
 * the chief panel shows immediately rather than spectator mode. */
const HotSeatApp = Client({
  game: Settlement,
  board: SettlementBoard,
  numPlayers: 4,
  debug: debugOpt,
}) as unknown as ComponentType<{ playerID?: string }>;

/** Read `?matchID=...&playerID=...&credentials=...` from the page URL.
 *
 * This is a developer-only bypass that skips both `<AuthForms>` and
 * the `verify()` step. In a production build we always return null —
 * an attacker with a stolen credentials triple should NOT be able to
 * paste it into a URL and walk past auth. The lobby is the only
 * sanctioned entry point in production.
 *
 * Vite inlines `import.meta.env.DEV` at build time (true under
 * `vite dev` / Vitest, false under `vite build`), so the production
 * bundle dead-code-eliminates the entire query-string branch. */
const readMatchFromQuery = (): {
  matchID: string;
  playerID: string;
  credentials: string;
} | null => {
  const isDev =
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
  if (!isDev) return null;
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

/** Hot-seat shell (14.1) — owns the "which seat is driving right now"
 * React state and provides it down to the SeatPicker via context.
 *
 * Why React state + context (rather than a module-level setter or a
 * ref to bgio's internal client): the bgio React Client class component
 * already calls `client.updatePlayerID()` whenever its `playerID` prop
 * changes, so passing the state value as a prop is the canonical way
 * to drive the swap. The SeatPicker lives inside the bgio Board and
 * cannot reach App's setter via plain props (bgio doesn't forward
 * extra props to the board), so a React Context is the seam. */
const HotSeatShell: ComponentType = () => {
  const [seat, setSeat] = useState<PlayerID>('0');
  return (
    <SeatPickerContext.Provider value={{ setSeat }}>
      <HotSeatApp playerID={seat} />
    </SeatPickerContext.Provider>
  );
};

/** Top-level App: pick networked vs hot-seat once at mount. The mode is
 * a build-time setting (`VITE_CLIENT_MODE`), so a re-evaluation on every
 * render would only burn CPU.
 *
 * Wraps both modes in `CardInfoProvider` + `DevTabContext.Provider` so
 * any card's `?` button and the dev-tab "Card relationships" entry both
 * open the same `RelationshipsModalHost`. The modal is a Dialog over
 * the running game — no navigation, the underlying boardgame.io Client
 * keeps ticking. */
const AppShell: ComponentType = () => {
  const mode = detectMode();
  // The relationships modal host now lives inside Board.tsx so it can
  // forward the live `G` to `buildCardGraph`. The DevSidebar also mounts
  // inside Board now so it has `props.moves` access for testing
  // shortcuts; it self-gates on `import.meta.env.DEV` and disappears in
  // production builds.
  //
  // Hash override: `#cards` opens the card-design preview page in any
  // build. Read at first render only — the preview page exposes a
  // "Back to game" button that resets the hash + reloads.
  if (
    typeof window !== 'undefined' &&
    window.location.hash === '#cards'
  ) {
    return <CardPreviewPage />;
  }
  return (
    <CardInfoProvider>
      {mode === 'networked' ? <Networked /> : <HotSeatShell />}
    </CardInfoProvider>
  );
};

const App: ComponentType = AppShell;

export default App;

// `SessionCreds` is re-exported here only so consumers that import App
// can treat the session-shape as a public API surface. The real shape
// lives in `./lobby/credentials.ts`.
export type { SessionCreds };
