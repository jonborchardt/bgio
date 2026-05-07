# Issue 003 — bgio `Server` constructed without `bots` config

**Severity**: high
**Area**: server / AI
**Effort**: medium
**Status**: not started

## Files
- `server/index.ts:61-78` — `serverConfig` is `{ games, db? }` only
- `server/idle/seatTakeover.ts` — flips `metadata.players[id].isBot = true` but no `bots` map exists
- CLAUDE.md "Project stance" — "Default game is 4 players, 1 human + 3 bots"

## Problem
Per CLAUDE.md, "Bots run server-side via `Server({ bots })` driven by each role's
`ai.enumerate(G, ctx, playerID)`." That wiring is absent. Without it, the networked
stack will never auto-fill seats for the default 1H+3B match unless every seat is
a human-driven SocketIO client — which contradicts the project stance. The idle
watcher's `seatTakeover` marks seats as bot but bgio still needs a `bots` config
to actually drive them.

## Fix sketch
1. Wire `Server({ games, db, bots: { ... } })`. Map each non-human seat ID to
   `RandomBot` or `MCTSBot` from `boardgame.io/ai`.
2. For per-match dynamic bot configuration (when humans pick seat-roles), store the
   bot-vs-human assignment on `metadata.bots` and let bgio resolve at create-match
   time.
3. Confirm `seatTakeover` actually triggers a bot move after marking a seat —
   write a focused test in `tests/server/idle.test.ts` (currently 4 it.todo there).

## Acceptance
- A new 4-player match created with 1 human + 3 bots progresses without manual
  client-side dispatch.
- After idle takeover, the abandoned seat takes a bot move within the configured
  cadence.
- `tests/server/idle.test.ts` it.todo for bot-takeover is implemented and passing.

## Related
- 001, 002 (deploy + auth foundation)
- 004 (scienceBot is a stub — even with bots wired, science seat plays nothing meaningful)
