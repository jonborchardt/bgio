# 04 — Fill empty seats with bots: enable N-humans + M-bots matches

**Severity**: medium-high (blocks any meaningful 4-player playtest
without recruiting 4 humans)
**Area**: lobby UI + small server-side helper
**Effort**: small (~30 lines client, ~20 lines server, plus a test)
**Status**: not started

## Problem

Today the lobby is a binary: Solo (every seat except yours is a bot)
or non-solo (every seat is a human, no bots). The two interesting
testing scenarios that fall through the gap:

- **2 humans + 2 bots**: invite a friend, fill the rest with bots so
  you don't need to wait for two more humans.
- **3 humans + 1 bot**: same thing for a 3-friend test.

The idleWatcher's seat-takeover only fires for seats that have been
*occupied at least once* and then went silent for `IDLE_TIMEOUT_MS`
(5 min). Never-joined seats are invisible to the watcher. So the
match would just hang waiting for empty seats.

## Files

New affordance:
- (new) Server: `server/lobby/fillBots.ts` — exports a small helper
  that, given a matchID, reads metadata, marks every still-empty seat
  as a bot (sets `isBot=true` plus a synthetic `name='Bot N'` so the
  seat shows as "occupied" in the lobby listing).
- (new) Server: a Koa route `POST /lobby/match/:matchID/fillBots`
  registered in `server/index.ts` after `Server({...})`. Auth-gated:
  only the user who created the match can fill it (or the user
  occupying seat 0).

Edited:
- [src/lobby/CreateMatchForm.tsx](../../src/lobby/CreateMatchForm.tsx)
  — keep the existing form but add a hint that says: "After
  creating, click the match → use 'Fill empty with bots' to start
  before all seats are human-filled."
- [src/lobby/LobbyShell.tsx](../../src/lobby/LobbyShell.tsx) — add
  a "Fill bots" button next to each match in the list (visible only
  when the user is in seat 0 of that match). Clicking it hits the
  new endpoint.
- [src/lobby/lobbyClient.ts](../../src/lobby/lobbyClient.ts) — small
  wrapper for the new endpoint (since it's not a bgio-stock route).

## Fix sketch

### Server: `fillBots` helper

```ts
// server/lobby/fillBots.ts
import { grantBotControl, type BgioServerLike } from '../idle/seatTakeover.ts';

export async function fillEmptySeatsWithBots(
  server: BgioServerLike,
  matchID: string,
): Promise<{ filled: string[] }> {
  const db = server.db;
  if (!db) return { filled: [] };
  const fetched = await db.fetch(matchID, { metadata: true });
  const metadata = fetched.metadata;
  if (!metadata?.players) return { filled: [] };

  const filled: string[] = [];
  for (const [seat, player] of Object.entries(metadata.players)) {
    // Empty = no name yet. Bot already? Skip.
    if (player?.name !== undefined) continue;
    if (player?.isBot === true) continue;
    await grantBotControl(server, matchID, seat);
    // Set a synthetic name so the seat reads as "occupied" in the
    // lobby listing — bgio's match-listing surfaces the `name` field
    // and clients use it as the "is this seat full?" signal.
    const fresh = await db.fetch(matchID, { metadata: true });
    const players = { ...(fresh.metadata?.players ?? {}) };
    players[seat] = { ...(players[seat] ?? {}), name: `Bot ${Number(seat) + 1}` };
    await db.setMetadata(matchID, { ...(fresh.metadata ?? {}), players });
    filled.push(seat);
  }
  return { filled };
}
```

### Server: Koa route

```ts
// In server/index.ts after creating `server = Server({...})`:
const koaApp = (server as unknown as { app: Koa }).app;
koaApp.use(async (ctx, next) => {
  if (ctx.method !== 'POST') return next();
  const m = /^\/lobby\/match\/([^/]+)\/fillBots$/.exec(ctx.path);
  if (!m) return next();
  // Auth: require a logged-in user; require they own seat 0 of the match.
  const token = (ctx.request.headers.authorization ?? '').replace('Bearer ', '');
  const user = await verifyToken(token);
  if (!user) {
    ctx.status = 401;
    return;
  }
  const matchID = m[1];
  const fetched = await server.db.fetch(matchID, { metadata: true });
  const seat0 = fetched.metadata?.players?.['0'];
  if (seat0?.name !== user.username) {
    ctx.status = 403;
    return;
  }
  const result = await fillEmptySeatsWithBots(server, matchID);
  ctx.status = 200;
  ctx.body = result;
});
```

(Path / verb / auth shape are sketch; align with the existing
`server/auth/routes.ts` patterns.)

### Client: button + wrapper

In `LobbyShell`, render a "Fill bots" button next to each match the
current user owns:

```tsx
{match.players[0]?.name === playerName ? (
  <Button size="small" onClick={() => fillBots(match.matchID)}>
    Fill empty with bots
  </Button>
) : null}

const fillBots = async (matchID: string) => {
  const token = loadAuthToken();
  await fetch(`${SERVER_URL}/lobby/match/${matchID}/fillBots`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  refresh();
};
```

## Tests

- Unit test for `fillEmptySeatsWithBots` against a fake-storage
  match: empty seats get marked as bots; existing humans / bots
  untouched. Lives in `tests/server/fillBots.test.ts`.
- Integration test against `createServer({ port: 0 })` for the
  `/lobby/match/:id/fillBots` route: returns 401 without auth,
  403 if not seat 0, 200 + JSON when authorized.

## Acceptance

- Lobby shows "Fill empty with bots" button next to a match the
  current user created (i.e., they hold seat 0).
- Clicking it: matches with N humans and (4 - N) empty seats become
  matches with N humans and (4 - N) bots; bot driver immediately
  starts dispatching their moves on the next tick.
- Non-creators see no button (or a disabled one).
- Once a seat is bot-filled, the lobby's match listing shows it as
  "Bot 2" / "Bot 3" / etc. so the count is consistent.
- The bot driver's existing dispatch loop (and PR #13's revoke logic)
  handles all the rest: bots play, a late-arriving human can
  still take a "Bot N" seat (revoke fires, bot stops, human plays).

## Risks / open questions

- **Coupling to seat 0 as "match owner"**. bgio's `Server` doesn't
  expose a "creator" field on match metadata; the convention "seat 0
  is the creator" is fine for V1 but a real owner field would be
  better. Out of scope here.
- **Auth wiring duplication**. We're hand-rolling auth on the new
  Koa route; the existing `/auth/*` routes have the same logic. A
  small middleware shared between them would clean this up. Defer.
- **Race against the bot driver's poll.** If the user clicks "Fill
  bots" right when the bot driver's next tick fires, both might call
  `grantBotControl` concurrently. Both calls are idempotent, so no
  correctness issue — just a possible doubled `setMetadata` write.
  Acceptable.

## Related

- 01 / 02 — separate concerns (stale state vs. connect failures).
- PR #13 — the "human takes over a bot seat" path. This plan
  produces the inverse case (creator marks empty seats as bots);
  PR #13 already handles the "human steals a bot seat" case.
