import type { ComponentType } from 'react';
import { Client } from 'boardgame.io/react';
import { Settlement } from './game/index.ts';
import { SettlementBoard } from './Board.tsx';
import { detectMode, networkedClientFactory } from './clientMode.ts';

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
 * This is a placeholder until 10.3 wires the real lobby. Until then, a
 * developer can bypass the lobby by supplying the three params directly
 * (e.g. after creating a match via the server REST endpoints). If any of
 * the three are missing we fall back to hot-seat so the existing UX never
 * breaks. */
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

const pickApp = (): ComponentType => {
  if (detectMode() === 'networked') {
    const match = readMatchFromQuery();
    if (match) {
      return networkedClientFactory(
        match.matchID,
        match.playerID,
        match.credentials,
      );
    }
    // No match coords yet — fall back to hot-seat so the page still
    // renders something useful. 10.3 will replace this branch with a
    // proper lobby UI.
  }
  return HotSeatApp as unknown as ComponentType;
};

const App = pickApp();

export default App;
