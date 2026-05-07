# Issue 002 — Match moves are not authenticated against accounts

**Severity**: critical
**Area**: server / auth
**Effort**: medium
**Status**: not started

## Files
- `server/index.ts:60-98` — `Server({ games, db })` constructed without `authenticateCredentials`
- `server/auth/accounts.ts` — mints tokens nobody validates
- `server/auth/middleware.ts` — extracts bearer but only used for `/auth/*` routes

## Problem
The auth module mints tokens, but those tokens are never compared to the
`playerCredentials` bgio uses to gate moves. `client.joinMatch(...)` returns its own
`playerCredentials` independent of any logged-in user. Anyone who knows a `matchID`
can join a seat without being logged in, and a logged-in user has no link to their
seat. CLAUDE.md explicitly calls out `authenticateCredentials` as the integration
point — it's currently absent.

## Fix sketch
1. Pass `authenticateCredentials: async (credentials, metadata) => {...}` into
   `new Server({...})`. The hook resolves the SPA-issued bearer token → user, then
   compares against the seat's stored token.
2. Lobby join flow: when an authenticated user joins a match, store their token
   (or a deterministic match-scoped derivation) on `metadata.players[id].credentials`
   so the bgio `playerCredentials` returned by `joinMatch` matches what
   `authenticateCredentials` will validate.
3. Log a warning (not an error) when a join arrives without a bearer token, to
   support the spectator path and unauthenticated dev clients.

## Acceptance
- A move sent with a stale or wrong token is rejected with bgio's standard
  `"unauthorized"` shape.
- Spectators (playerID === null) still see a redacted view.
- Tests in `tests/server/` cover: (a) authenticated move accepted, (b) wrong
  token rejected, (c) no-token spectator allowed, (d) cross-seat impersonation
  rejected.

## Related
- 001 (deploy blocker)
- 007 (run history would attribute matches to authenticated users)
- 026 (auth rate-limit hardening)
