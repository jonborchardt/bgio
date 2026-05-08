// Plan 04 — fill empty seats with bots.
//
// Lets a match's owner (the user holding seat 0 with their name set)
// flip every still-empty seat to a server-side bot before the rest of
// the seats are filled by humans. Without this, "2 humans + 2 bots"
// matches aren't expressible in the lobby — solo mode flips ALL non-
// human seats to bots, non-solo flips NONE.
//
// The actual flag-flipping reuses `grantBotControl` from
// `server/idle/seatTakeover.ts`, the same primitive the idleWatcher
// uses for seat-takeover. Idempotent.
//
// Auth: bearer-token + "your name is on seat 0 of this match." We
// reuse the auth module's `verify()` to translate the token to a
// username, then check that against `metadata.players['0'].name`.
// Anyone else gets 401 (no token) or 403 (token doesn't own seat 0).

import { verify } from '../auth/accounts.ts';
import {
  grantBotControl,
  type BgioServerLike,
} from '../idle/seatTakeover.ts';

interface PlayerEntry {
  isBot?: boolean;
  name?: string;
  credentials?: string;
}

interface MatchMetadata {
  players?: Record<string, PlayerEntry | undefined>;
  [k: string]: unknown;
}

interface FilledStorage {
  fetch: (
    matchID: string,
    opts: { metadata?: boolean },
  ) => Promise<{ metadata?: MatchMetadata }>;
  setMetadata: (matchID: string, metadata: MatchMetadata) => Promise<void>;
}

const getDb = (
  server: BgioServerLike | null | undefined,
): FilledStorage | null => {
  const db = server?.db as Partial<FilledStorage> | undefined;
  if (
    !db ||
    typeof db.fetch !== 'function' ||
    typeof db.setMetadata !== 'function'
  )
    return null;
  return db as FilledStorage;
};

/**
 * Mark every still-empty seat (`name === undefined`) on `matchID` as a
 * bot so the bot driver picks them up on its next tick. Returns the
 * list of seat IDs that were flipped (already-bot or already-human
 * seats are skipped).
 *
 * Each flip:
 *   1. `grantBotControl` — sets `isBot=true` (idempotent).
 *   2. Re-fetch metadata + write back with a synthetic `name` like
 *      "Bot 2" so the seat reads as "occupied" in the lobby's
 *      match listing (the listing surfaces `name` as the "is this
 *      seat full?" signal).
 */
export const fillEmptySeatsWithBots = async (
  server: BgioServerLike,
  matchID: string,
): Promise<{ filled: string[] }> => {
  const db = getDb(server);
  if (!db) return { filled: [] };
  const fetched = await db.fetch(matchID, { metadata: true });
  if (!fetched.metadata?.players) return { filled: [] };

  const filled: string[] = [];
  // Sort seat IDs to keep the order deterministic across calls.
  const seats = Object.keys(fetched.metadata.players).sort();
  for (const seat of seats) {
    const player = fetched.metadata.players[seat];
    if (player?.name !== undefined) continue;
    if (player?.isBot === true) continue;
    await grantBotControl(server, matchID, seat);
    // Re-fetch so we layer the synthetic name on top of the bot flag
    // grantBotControl just wrote (rather than racing the writes).
    const updated = await db.fetch(matchID, { metadata: true });
    const players: Record<string, PlayerEntry | undefined> = {
      ...(updated.metadata?.players ?? {}),
    };
    players[seat] = {
      ...(players[seat] ?? {}),
      name: `Bot ${Number(seat) + 1}`,
    };
    await db.setMetadata(matchID, {
      ...(updated.metadata ?? {}),
      players,
    });
    filled.push(seat);
  }
  return { filled };
};

// ---- Koa route mounting -----------------------------------------------------

interface KoaCtx {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  status: number;
  type: string;
  body: unknown;
  set: (k: string, v: string) => void;
}
interface KoaApp {
  use: (
    mw: (ctx: KoaCtx, next: () => Promise<void>) => Promise<void>,
  ) => unknown;
}

const headerString = (
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const raw = headers[key];
  if (Array.isArray(raw)) return raw[0];
  return raw;
};

const extractBearer = (
  headers: Record<string, string | string[] | undefined>,
): string | undefined => {
  const auth = headerString(headers, 'authorization');
  if (!auth) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m?.[1];
};

const resolveAllowedOrigins = (): string[] | '*' => {
  const raw =
    typeof process !== 'undefined' ? process.env?.ALLOWED_ORIGINS : undefined;
  if (typeof raw !== 'string' || raw.length === 0) return '*';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length === 0 ? '*' : list;
};

const chooseAllowOrigin = (
  reqOrigin: string | undefined,
  allowed: string[] | '*',
): string => {
  if (allowed === '*') return '*';
  if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin;
  return allowed[0] ?? '*';
};

const send = (ctx: KoaCtx, status: number, body: unknown): void => {
  ctx.status = status;
  ctx.type = 'application/json';
  ctx.body = body;
};

const ROUTE_RE = /^\/lobby\/match\/([^/]+)\/fillBots$/;

/** Attach POST /lobby/match/:matchID/fillBots to bgio's Koa app.
 * Idempotent: don't call twice on the same app. */
export const mountFillBotsRoute = (
  app: KoaApp,
  server: BgioServerLike,
): void => {
  app.use(async (ctx, next) => {
    const path = ctx.url.split('?')[0] ?? '';
    const match = ROUTE_RE.exec(path);
    if (!match) {
      await next();
      return;
    }
    const matchID = match[1] ?? '';

    // CORS preflight — same allow-list as the auth routes use.
    const allowed = resolveAllowedOrigins();
    const reqOrigin = headerString(ctx.headers, 'origin');
    const allowOrigin = chooseAllowOrigin(reqOrigin, allowed);
    ctx.set('access-control-allow-origin', allowOrigin);
    if (ctx.method === 'OPTIONS') {
      ctx.set('access-control-allow-headers', 'authorization, content-type');
      ctx.set('access-control-allow-methods', 'POST, OPTIONS');
      send(ctx, 204, '');
      return;
    }

    if (ctx.method !== 'POST') {
      send(ctx, 405, { error: 'POST only' });
      return;
    }

    const token = extractBearer(ctx.headers);
    if (!token) {
      send(ctx, 401, { error: 'missing bearer token' });
      return;
    }
    const result = await verify(token);
    if (!result.user) {
      send(ctx, 401, { error: 'invalid or expired token' });
      return;
    }

    // Owner check: the bearer's username must match the name on
    // seat 0 of the match. (Seat 0 is convention for "match creator"
    // — bgio doesn't expose a creator field; the chief seat in our
    // assignRoles always lands on seat 0.)
    const db = getDb(server);
    if (!db) {
      send(ctx, 503, { error: 'storage unavailable' });
      return;
    }
    let metadata: MatchMetadata | undefined;
    try {
      const fetched = await db.fetch(matchID, { metadata: true });
      metadata = fetched.metadata;
    } catch {
      send(ctx, 404, { error: 'match not found' });
      return;
    }
    const seat0 = metadata?.players?.['0'];
    if (!seat0 || seat0.name !== result.user.username) {
      send(ctx, 403, { error: 'only the match owner can fill bot seats' });
      return;
    }

    const filled = await fillEmptySeatsWithBots(server, matchID);
    send(ctx, 200, filled);
  });
};
