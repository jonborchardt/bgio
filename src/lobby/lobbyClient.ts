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
import { getServerURL } from '../clientMode.ts';

/** Match-creation payload that rides on
 * `lobbyClient.createMatch(..., { setupData })`. Settlement's
 * `setup(ctx, setupData)` is the canonical declaration; we re-export
 * the type here so the lobby surface and engine surface can't drift —
 * a typo at the lobby form fails the build, not silently at game
 * start. */
export type { SettlementSetupData } from '../game/setup.ts';

/** Construct one LobbyClient at module load. The bgio server URL is
 * resolved through the same `getServerURL()` networked-mode path uses,
 * so a single env var (`VITE_SERVER_URL`) drives both transports. */
export const lobby: LobbyClient = new LobbyClient({ server: getServerURL() });
