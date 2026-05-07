# Issue 023 — Auth rate-limit: unbounded map + global to process + proxy IP collapse

**Severity**: medium
**Area**: server / security
**Effort**: small
**Status**: not started

## Files
- `server/auth/routes.ts:1-238` — hand-rolled `buckets = new Map<string, BucketRow>()`
- `server/auth/routes.ts:33-65, 181-187` — bucket capacity 10, refill 1/6s

## Problem
1. **Map leak**: `buckets` is in-memory only, never evicts, grows by every unique
   remote IP. A long-running server accumulates one entry per attacker IP →
   memory leak / DoS amplifier.
2. **Multi-instance**: in-memory state doesn't survive a Render upgrade to
   multiple instances.
3. **Proxy IP collapse**: Koa's `ctx.ip` honours `X-Forwarded-For` only when
   `app.proxy = true` is set on the bgio Server's Koa instance — there's no
   evidence it is. Behind Render's edge that means every request appears to come
   from the proxy IP, collapsing all attackers into one bucket.

## Fix sketch
1. Cap `buckets.size` at e.g. 10000 with LRU eviction.
2. Set `app.proxy = true` on the bgio Server's Koa instance (or trust a
   configurable proxy header if running behind a non-Render proxy).
3. For multi-instance scaling, defer to a follow-up; in the meantime document
   that auth rate-limit assumes single-instance.

## Acceptance
- Synthetic test floods the rate-limiter with 100k unique IPs and `buckets.size`
  stays bounded.
- `ctx.ip` returns the original client IP when behind a proxy with
  `X-Forwarded-For` set.

## Related
- 002 (auth correctness)
