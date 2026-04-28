// Single shared LobbyClient instance — bgio's REST wrapper around the
// server's `/games/:name/...` endpoints. Anyone touching the lobby REST
// surface (LobbyShell, the 10.6 reconnect probe, future spectator listing,
// etc.) imports `lobby` from here rather than constructing their own.
//
// Per CLAUDE.md: bgio ships LobbyClient with full coverage of
// listGames / listMatches / getMatch / createMatch / joinMatch / leaveMatch /
// updatePlayer / playAgain — we don't write a sibling `api.ts` over the
// same endpoints.

import { LobbyClient } from 'boardgame.io/client';
import type { ResourceBag, Role } from '../game/index.ts';
import { getServerURL } from '../clientMode.ts';

/** Match-creation payload that rides on `lobbyClient.createMatch(..., { setupData })`.
 *
 * Settlement's `setup(ctx, setupData)` reads these fields to override per-match
 * defaults (turn cap, solo toggle, starting bank). Keep this in lockstep with
 * the game-side `setup` consumer so a typo at the lobby form fails the build,
 * not silently at game start. */
export interface SettlementSetupData {
  /** Round cap before time-up triggers (08.5). Engine default = 80. */
  turnCap?: number;
  /** When true, the match is solo — server-side runBot workers (10.9) drive
   * every non-human seat using `buildBotMap({ numPlayers, humanRole })`
   * from `src/lobby/soloConfig.ts`. */
  soloMode?: boolean;
  /** Required when `soloMode === true`: which role the human plays. The
   * seat that owns this role becomes the human seat; every other seat is
   * driven by a composed bot covering its assigned roles. */
  humanRole?: Role;
  /** Per-match override on the bank's starting fill. Partial = merge over default. */
  startingBank?: Partial<ResourceBag>;
}

/** Construct one LobbyClient at module load. The bgio server URL is
 * resolved through the same `getServerURL()` networked-mode path uses,
 * so a single env var (`VITE_SERVER_URL`) drives both transports. */
export const lobby: LobbyClient = new LobbyClient({ server: getServerURL() });
