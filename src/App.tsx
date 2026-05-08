import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { Client } from 'boardgame.io/react';
import { Settlement } from './game/index.ts';
import { SettlementBoard } from './Board.tsx';
import {
  detectMode,
  getServerURL,
  networkedClientFactory,
} from './clientMode.ts';
import { LobbyShell } from './lobby/LobbyShell.tsx';
import { lobby } from './lobby/lobbyClient.ts';
import {
  clearCreds,
  loadCreds,
  saveCreds,
  type SessionCreds,
} from './lobby/credentials.ts';
import { SeatPickerContext } from './ui/layout/SeatPickerContext.ts';
import { CardInfoProvider } from './ui/cards/CardInfoContext.tsx';
import { CardPreviewPage } from './ui/cardPreview/CardPreviewPage.tsx';
import { MatPreviewPage } from './ui/matPreview/MatPreviewPage.tsx';
import { BoardPreviewPage } from './ui/boardPreview/BoardPreviewPage.tsx';
import { FuzzPage } from './fuzz/FuzzPage.tsx';
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
  // creds but haven't mounted yet we just show "Connecting…". The full
  // retry-with-backoff loop lands in plan 02 (connection-recovery) under
  // plans/networked-finish/.
  const [connecting] = useState(false);

  // Stale-creds probe (plan 01). When we restore from localStorage at
  // mount, the persisted (matchID, playerID, credentials) triple may
  // refer to a match the server no longer knows about — Render's free
  // tier wipes the in-memory store on every cold start, and a leaked
  // session token is invisible to the user. Hit `getMatch` once before
  // mounting bgio's Client; if the server doesn't recognize the match
  // (or our seat isn't there), drop the persisted creds and bounce to
  // the lobby instead of stalling forever on bgio's "connecting…"
  // loading state. New joins (onSelect → setMatch) skip the probe — we
  // just got the match from the join REST so it definitely exists.
  type ProbeStatus = 'idle' | 'probing' | 'done';
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>(() =>
    // Only probe on initial mount with restored creds; query-string
    // overrides (developer flow) and fresh joins skip the round trip.
    loadCreds() !== null ? 'probing' : 'done',
  );

  useEffect(() => {
    if (probeStatus !== 'probing') return;
    if (!match) {
      setProbeStatus('done');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await lobby.getMatch('settlement', match.matchID);
        if (cancelled) return;
        if (!result || !Array.isArray(result.players)) {
          throw new Error('match has no players');
        }
        // Spectators (playerID === null) only need the match to exist.
        if (match.playerID !== null) {
          const seat = result.players.find(
            (p) => String(p.id) === match.playerID,
          );
          // The seat must still carry our name. After a server cold
          // start, the player slot is recycled to `{ id: N }` with no
          // name and no credentials — that's our "session is dead"
          // signal. (Credentials are stripped from the public listing
          // so we can't compare them directly.)
          if (!seat || typeof seat.name !== 'string' || seat.name === '') {
            throw new Error('seat is empty');
          }
        }
        setProbeStatus('done');
      } catch {
        if (cancelled) return;
        clearCreds();
        setMatch(null);
        setProbeStatus('done');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [probeStatus, match]);

  const NetworkedApp = useMemo<ComponentType | null>(() => {
    if (!match) return null;
    if (probeStatus === 'probing') return null;
    return networkedClientFactory(
      match.matchID,
      match.playerID,
      match.credentials,
    );
  }, [match, probeStatus]);

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

  // When `match` flips back to null (the "Leave match" button below),
  // drop the persisted creds so a refresh doesn't re-mount the dead
  // session. The hook stays separate from the click handler so it also
  // covers any future code path that clears the match state.
  useEffect(() => {
    if (match === null) {
      clearCreds();
    }
  }, [match]);

  if (probeStatus === 'probing') {
    // The brief window between mount-with-restored-creds and the
    // probe's outcome. Without this, the bgio Client mounts before
    // the probe finishes and a dead session shows the
    // "connecting…" hang for the full retry window.
    return (
      <Stack spacing={1} sx={{ alignItems: 'center', p: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2">Resuming session…</Typography>
      </Stack>
    );
  }

  if (NetworkedApp) {
    if (connecting) {
      return (
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Connecting…</Typography>
        </Stack>
      );
    }
    // The bgio Client owns its own render tree; we render a sibling
    // header above it so the escape hatch is always reachable. Leaving
    // a match abandons the seat — the idleWatcher will mark it as a
    // bot, other players continue without us.
    return (
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1 }}>
          <Button size="small" variant="outlined" onClick={() => setMatch(null)}>
            Leave match
          </Button>
        </Box>
        <NetworkedApp />
      </Stack>
    );
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
  // Hash override: `#cards` opens the card-design preview page,
  // `#mats` opens the player-mat design preview page. Both are
  // reachable in any build. Read at first render only — each preview
  // page exposes a "Back to game" button that resets the hash + reloads.
  // Defense redesign 3.9 — `#fuzz` opens the headless 4-player
  // RandomBot driver used by the e2e smoke spec. Dev-only (the build
  // dead-code-eliminates the page outside `import.meta.env.DEV`).
  if (typeof window !== 'undefined') {
    if (window.location.hash === '#cards') {
      return <CardPreviewPage />;
    }
    if (window.location.hash === '#mats') {
      return <MatPreviewPage />;
    }
    if (window.location.hash === '#boards') {
      return <BoardPreviewPage />;
    }
    const isDev =
      (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
    // Accept `#fuzz` exact-match or `#fuzz?…` so callers (e.g. the
    // e2e smoke spec) can pass a seed via the hash query without
    // tripping the strict equality check.
    if (
      isDev &&
      (window.location.hash === '#fuzz' ||
        window.location.hash.startsWith('#fuzz?'))
    ) {
      return <FuzzPage />;
    }
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
