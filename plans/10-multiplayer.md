# 10 — Multiplayer infra

> **Status: done** (all sub-plans landed; see
> [STATUS.md](STATUS.md) for the canonical per-row state).
> Caveats: `/auth` REST routes are mounted (review fix), but the
> accounts + runs stores are in-memory; the SQLite swap is a deploy
> concern (see 13.3). End-to-end networked playtest is unverified —
> [14.11](14.11-networked-playtest.md) schedules it.

## Goal

Move from hot-seat-only to seat-per-browser networked play, with a lobby,
durable storage, and chat — without changing the gameplay model.

## Scope

**bgio-first stance for this whole stage.** Everything here either uses
a bgio export verbatim or layers a thin React/UX shell over it. Concrete
mapping:

| Concern | bgio surface |
|---------|--------------|
| Server | `Server` from `boardgame.io/server` (Koa) |
| Networked client | `SocketIO` from `boardgame.io/multiplayer` |
| Lobby UI | `Lobby` from `boardgame.io/react` |
| Lobby REST | `LobbyClient` from `boardgame.io/client` |
| Storage | `FlatFile` from `boardgame.io/server`; community / hand-rolled adapters implement bgio's `Async` interface (no parallel `Storage` type) |
| Chat | built-in `client.chatMessages` + `client.sendChatMessage()` (bgio 0.50.x ships these) |
| Spectators | bgio's `playerID === null` semantics + `playerView` |
| Reconnect | SocketIO transport's built-in reconnect; we only persist credentials |
| Auth | bgio Server's `authenticateCredentials` hook |
| Bots / idle takeover | bgio Server's bot infrastructure (`bots` config, `runBot`); shared with stage 11 |

**In:**
- bgio Server as a separate Vite-built process / package. Runs the
  same `Settlement` Game definition the client imports.
- Transport: SocketIO via `boardgame.io/multiplayer` (default). Keep the
  door open for a future WebSocket-only transport if perf demands it.
- Lobby: render bgio's `Lobby` component with a custom `renderer` to
  inject MUI styling and a seat-with-roles picker (binding seats to
  roles per game-design.md §Players). Headless flows use bgio's
  `LobbyClient`.
- Storage: bgio's `FlatFile` for dev; a Sqlite path for prod. Both
  satisfy bgio's `Async` interface. **No custom `Storage` interface.**
- Auth: **named accounts in V1** (see 10.7). Anonymous play exists only
  on the GH Pages hot-seat fallback; the canonical multiplayer flow
  requires login and authenticates against bgio's
  `authenticateCredentials` Server hook. Run history persists in the
  DB, keyed to the user.
- Chat: bgio 0.50.x's built-in `chatMessages` / `sendChatMessage`. **No
  custom plugin or move.** Public game-chat only — no per-team /
  per-role private channels in V1.
- Spectators: 10.8 lets non-seat viewers watch a match; bgio already
  treats `playerID === null` as a spectator and routes through
  `playerView`.

**Out:**
- Host choice (Render / Fly / Cloudflare / self-host) — lives in stage 13.
- Account system, OAuth, profiles.
- Spectator mode.

## Depends on

01, 02. Everything else (resources, roles) is the same code; the server just
runs it.

## Sub-plans

- `10.1-server-package.md` — split repo into client + server packages OR add
  a `server/` directory the same `tsconfig.app.json` ignores; pick after
  measuring how much shared code exists.
- `10.2-transport-and-client-modes.md` — `App.tsx` chooses local vs
  networked transport via env var; preserve hot-seat as a build target.
- `10.3-lobby.md` — render bgio's `Lobby` component; inject seat-role
  picker; share one `LobbyClient` for headless calls.
- `10.4-storage.md` — factory returning bgio's `Async` (FlatFile for
  dev, Sqlite for prod). No new interface.
- `10.5-chat.md` — React surface over bgio's built-in chat
  (`chatMessages` / `sendChatMessage`). No plugin.
- `10.6-reconnect-and-credentials.md` — refresh / reconnect flow,
  credential persistence in `localStorage`, server-down spinner with
  retry.
- `10.7-accounts.md` — username/password accounts, run-history table,
  game-end persistence hook.
- `10.8-spectators.md` — spectator join flow + lobby surface.
- `10.9-idle-bot-takeover.md` — when a player goes idle for N minutes, a
  server-side bot for their role takes over so the match keeps moving.

## Test surface

- A two-process integration test boots a server, two headless clients
  join, take seats, play a round, disconnect, and reconnect.
- Storage interface: round-trip save + load preserves `G`, `ctx`,
  `playerView` mapping.
- Chat: messages from one client are visible to the other within `T_max`
  ms.
