# 04 — Multi-instance readiness: Socket.IO + in-process state

**Severity**: high (blocks plan 03 option B; not blocking option A)
**Area**: server / scaling
**Effort**: medium
**Status**: not started — only kicks in if/when plan 03 picks Postgres
or we raise `maxScale`

## TL;DR

Today the bgio server holds match state, idle timestamps, bot timers,
and the auth rate-limit table in process memory. With `maxScale=1`
that's all fine. The moment the service runs more than one instance,
three things break:

1. **SocketIO clients connected to instance A do not see moves
   produced on instance B.** Without a pub/sub adapter, each Node
   process has its own SocketIO room map.
2. **Bot driver and idle watcher fire from every instance.** Two
   instances each running the polling loop will each try to play the
   bot's move; bgio rejects the duplicate but it's wasted work and a
   thundering-herd risk.
3. **In-process maps lose meaning.** Idle activity recorded on A is
   invisible on B; rate-limit tokens for an attacker are diluted by
   `1/N`.

This plan keeps the V1 default (`maxScale=1`) and lays out the work
needed to lift that cap. It is the prerequisite for ever switching
plan 03 to Postgres.

## Files

The audit list below — these are the load-bearing in-process state
sites:

- [server/index.ts:114](../../server/index.ts) — `Server({ db, ... })`.
  The default SocketIO transport ships with no adapter override.
- [server/bots/botDriver.ts](../../server/bots/botDriver.ts) — server
  bot polling loop; one timer per instance.
- [server/idle/idleWatcher.ts](../../server/idle/idleWatcher.ts) —
  in-memory `Map<matchID, Map<playerID, lastActivity>>`.
- [server/auth/routes.ts:79](../../server/auth/routes.ts) — per-IP
  token-bucket map.
- [server/index.ts:155-179](../../server/index.ts) — log-compaction
  interval; runs once per instance.

## Problem (in detail)

### SocketIO + bgio

`Server` from `boardgame.io/server` constructs an `http.Server` and
attaches a SocketIO instance to it. bgio routes moves into rooms keyed
by `matchID`. With one Node process the room map is in memory and
broadcasts work. With N processes behind a load balancer:

- Player 1 connects → load balancer routes to instance A → instance A
  joins them to room `match:abc`.
- Player 2 connects → routes to instance B → instance B joins them
  to its own room `match:abc`.
- Player 1 sends a move → instance A applies it, broadcasts in its
  own room → Player 2 hears nothing.

Two fixes:

- **Sticky sessions** keep both players on the same instance. Cloud
  Run's `sessionAffinity: true` does this for SocketIO as long as the
  client doesn't disconnect / reconnect to a different instance.
  Insufficient on its own: a deploy-and-reconnect can land them on
  different instances.
- **A pub/sub adapter** ({Redis, NATS, Postgres LISTEN/NOTIFY}) shares
  the room map across instances. The community-standard one is
  `@socket.io/redis-adapter`, used widely for exactly this. bgio
  doesn't expose a hook for the SocketIO instance directly, but the
  `lobby` SocketIO server is constructed inside bgio's `transport`
  module — we'd have to wrap or replace the default transport.
  Plausible but non-trivial.

### Bot driver + idle watcher under autoscale

`makeBotDriver` and `makeIdleWatcher` both `setInterval` on boot. With
two instances, both tick the same matches:

- Bot driver: tries to fetch a match's metadata, sees a bot seat is
  active, makes the move. Two instances both do this; bgio's auth /
  state-version checks reject the second attempt. Result: half the
  bot-move work is thrown away. Not a correctness bug, but ugly under
  observation and load.
- Idle watcher: each instance has its own activity map. Player on
  instance A is "active"; same player on instance B is "silent for
  5 minutes" and gets handed to a bot. Real correctness bug.

### Auth rate limits

Per-IP token bucket per instance: with N instances, an attacker gets
`N×` the throughput. Mitigation, not correctness — but the value of
the limit drops to `BUCKET_CAPACITY / N`. Shared store (Redis again,
or a Postgres advisory lock) fixes it.

## Fix sketch (when V1 outgrows A)

### 1. SocketIO Redis adapter

`@socket.io/redis-adapter` + a managed Redis (Memorystore on GCP or
Upstash). bgio doesn't pass options through; the cleanest seam is to
construct our own `socket.io` instance, then have bgio attach to it.
The bgio `Server` factory accepts a `transport` option that lets us
inject a transport instance; sketch:

```ts
import { SocketIO as BgioSocketIO } from 'boardgame.io/server';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

const transport = new BgioSocketIO({
  https: undefined,
  socketAdapter: createAdapter(pubClient, subClient),
});

const server = Server({ games, db, transport, /* ... */ });
```

(The exact prop names depend on the bgio version; `bgio` 0.50.x uses
`socketAdapter` per the source. Verify before relying on it.)

### 2. Single-leader bot driver + idle watcher

Two patterns work:

- **Cron / scheduled runner.** Move the bot loop and idle sweep to a
  Cloud Scheduler → Cloud Run Jobs cron that fires once per minute.
  One instance, one tick. The bgio `Server` itself stays request-only
  and stateless.
- **Distributed lock.** Each instance tries to acquire a Redis lock;
  whoever holds it runs the timers. Cheap, single binary.

The Cloud Scheduler path is cleaner and matches Cloud Run's
"stateless containers" stance. Recommend that route once we get here.

### 3. Shared rate-limit store

The simplest fix: replace the in-memory `buckets` Map in
[server/auth/routes.ts](../../server/auth/routes.ts) with a Redis
backed token bucket (`INCR` + `EXPIRE`). The seam is small — the
`consumeToken(ip)` function is the only call site.

### 4. Log-compaction timer

Move it to the same scheduler that runs the idle sweep, or accept
that N instances each running it weekly is harmless waste.

## Acceptance (only meaningful once invoked)

- Two Cloud Run instances behind a real load balancer, sticky sessions
  on, can both serve the same match — moves from a client connected
  to A are visible on a client connected to B.
- Bot timer and idle sweep tick exactly once per period across the
  fleet (verifiable from log line counts).
- A scripted `ab`-style auth-spam test triggers the rate limit at
  `BUCKET_CAPACITY` total attempts, not `N × BUCKET_CAPACITY`.

## Risks / open questions

- **Cost.** Adding Redis + Cloud Scheduler is ~$5–15/mo on top of
  Cloud Run + Cloud SQL. Worth it only when V1 is proven and load is
  real.
- **bgio's transport option is brittle.** Their docs are sparse on
  `socketAdapter` injection; this is a real risk and may want a
  small upstream PR rather than a wrapper. Investigate before
  committing.
- **Cloud Scheduler can't replace the idle watcher exactly.** The
  current watcher records activity timestamps on every move; moving
  it to a cron means we also need to persist activity to Redis or the
  DB. Manageable but a second-order change.

## Related

- 03 — option B (Postgres) requires this plan; option A defers it.
- 02 — `maxScale` is the gating knob; this plan justifies the
  current `1` value.
- 023 (auth rate limit unbounded) — solved per-instance there;
  here is where we'd make it cluster-wide.
