# Issue 025 — CI smoke spec only runs hot-seat fuzz; no networked end-to-end test

**Severity**: medium
**Area**: tests / ci
**Effort**: medium-large
**Status**: not started

## Files
- `tests-e2e/smoke.spec.ts:38-69`
- `.github/workflows/ci.yml:72-73`
- `playwright.config.ts` — `webServer.command` is `npm run dev` (hot-seat, Vite only)

## Problem
The smoke spec exercises the in-browser fuzz harness (hot-seat), not the bgio
Koa server. CLAUDE.md flags "networked playtest is still unverified end-to-end" —
this is the place to land that. The networked path (auth, lobby, SocketIO,
spectator, reconnect) has zero end-to-end coverage in CI.

## Fix sketch
Add a Playwright project that:
1. Boots `npm run dev:full` (server + client).
2. Opens two tabs.
3. Tab A: register a user via `/auth/register`, create a 4-player match.
4. Tab B: register a second user, join the same match.
5. Drive a few rounds of moves.
6. Assert state convergence and no console errors.

Mark this as a separate Playwright project so the existing fuzz spec stays cheap
to run.

## Acceptance
- New e2e spec passes on CI.
- A regression in auth, lobby, or SocketIO transport reliably fails this spec.

## Related
- 002, 003 (auth + bots wiring — preconditions)
- 028 (related test coverage)
