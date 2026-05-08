// Plan 04 — client wrapper for the custom POST /lobby/match/:id/fillBots
// route. Not part of bgio's stock LobbyClient surface, so it lives
// alongside but separate from `lobbyClient.ts`.
//
// The server's auth check requires a bearer token + that the bearer's
// username matches the name on seat 0 of the match. Anything else
// returns 401/403 and we surface the message back to the caller.

import { getServerURL } from '../clientMode.ts';

const url = (path: string): string => {
  const base = getServerURL().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/** Mark every still-empty seat of `matchID` as a bot. The server returns
 * the list of seat IDs that were flipped (empty array if every seat
 * was already filled or already a bot). Throws on auth failures /
 * non-2xx responses. */
export const fillBots = async (
  matchID: string,
  token: string,
): Promise<string[]> => {
  const res = await fetch(url(`/lobby/match/${matchID}/fillBots`), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let message = `request failed: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Non-JSON body — fall through to the generic message.
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { filled?: string[] };
  return data.filled ?? [];
};
