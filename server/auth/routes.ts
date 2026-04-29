// 10.7 follow-up — mount /auth/* routes on bgio's Koa app.
//
// bgio's `Server` returns an instance with a `.app` property (the underlying
// Koa app). We attach a small middleware that handles three endpoints with
// no router dependency: POST /auth/register, POST /auth/login, GET /auth/verify.
// JSON parsing is done inline to avoid pulling in @koa/router or koa-bodyparser
// when the surface area is this small.
//
// The accounts module (`./accounts.ts`) backs all three; password hashing is
// scrypt via `./passwordHash.ts`. Errors return JSON `{ error: string }` with
// HTTP 4xx/5xx; success returns the same `LoginResult` / `AuthUser` shape the
// browser-side `src/lobby/authClient.ts` expects.
//
// V1 abuse mitigations:
//   - Body cap of 64 KiB on POST. Anything larger gets a 413 and is
//     drained without parsing — without this an attacker can spew
//     gigabytes into readJsonBody() before JSON.parse fails.
//   - Per-IP token bucket. Each remote address gets BUCKET_CAPACITY
//     attempts; the bucket refills at BUCKET_REFILL_PER_SEC. Login
//     and register share the bucket because brute-force on one
//     drains the same accounts table either way.

import { register, login, verify } from './accounts.ts';

/** Hard cap on auth-endpoint POST body size. 64 KiB is generous for
 * a {username, password} pair (max realistic ~100 bytes) while still
 * catching multi-MB DOS payloads. */
const MAX_BODY_BYTES = 64 * 1024;

/** Token-bucket per remote IP, applied on POST endpoints only.
 * GET /auth/verify is read-only and rate-limited implicitly by the
 * client's session lifecycle. */
const BUCKET_CAPACITY = 10;
const BUCKET_REFILL_PER_SEC = 1 / 6; // 10 attempts per minute, sustained.

interface BucketRow {
  /** Tokens remaining. Decrements on each request. */
  tokens: number;
  /** Last refill time in epoch ms. */
  lastRefill: number;
}

const buckets = new Map<string, BucketRow>();

/** Charge one token from `ip`'s bucket; returns true if the request
 * is allowed and false if the bucket was empty. Refills before
 * charging so a long quiet period is forgiven. */
const consumeToken = (ip: string): boolean => {
  const now = Date.now();
  let row = buckets.get(ip);
  if (!row) {
    row = { tokens: BUCKET_CAPACITY, lastRefill: now };
    buckets.set(ip, row);
  } else {
    const elapsedSec = (now - row.lastRefill) / 1000;
    const refill = elapsedSec * BUCKET_REFILL_PER_SEC;
    if (refill >= 1) {
      row.tokens = Math.min(BUCKET_CAPACITY, row.tokens + Math.floor(refill));
      row.lastRefill = now;
    }
  }
  if (row.tokens <= 0) return false;
  row.tokens -= 1;
  return true;
};

/** Test helper — wipe the per-IP rate-limit table. */
export const __resetAuthRateLimitForTest = (): void => {
  buckets.clear();
};

interface KoaCtx {
  request: { method: string; url: string; headers: Record<string, string | string[] | undefined>; req: NodeJS.ReadableStream };
  response: { status: number; body: unknown; type?: string; set: (key: string, value: string) => void };
  status: number;
  body: unknown;
  type?: string;
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  req: NodeJS.ReadableStream;
  ip?: string;
  set: (key: string, value: string) => void;
}

interface KoaApp {
  use: (mw: (ctx: KoaCtx, next: () => Promise<void>) => Promise<void> | void) => unknown;
}

/** Streams `req` into a Buffer with a hard byte cap. Returns
 * `{ ok: true, body }` on success or `{ ok: false }` if the cap
 * was exceeded — in the latter case the request body is fully
 * drained but ignored so the connection can close cleanly. */
const readJsonBody = async (
  req: NodeJS.ReadableStream,
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; reason: 'too-large' }
> => {
  const chunks: Buffer[] = [];
  let total = 0;
  let exceeded = false;
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      total += buf.length;
      if (total > MAX_BODY_BYTES) {
        exceeded = true;
        // Don't accumulate further; just drain.
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => resolve());
    req.on('error', (err: Error) => reject(err));
  });
  if (exceeded) return { ok: false, reason: 'too-large' };
  if (chunks.length === 0) return { ok: true, body: {} };
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return { ok: true, body: {} };
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || typeof parsed !== 'object') return { ok: true, body: {} };
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: true, body: {} };
  }
};

const send = (ctx: KoaCtx, status: number, body: unknown): void => {
  ctx.status = status;
  ctx.type = 'application/json';
  ctx.body = body;
};

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

/** Attach POST /auth/register, POST /auth/login, GET /auth/verify to the
 * bgio Koa app. Idempotent: don't call twice on the same app. */
export const mountAuthRoutes = (app: KoaApp): void => {
  app.use(async (ctx, next) => {
    const path = ctx.url.split('?')[0] ?? '';
    if (!path.startsWith('/auth/')) {
      await next();
      return;
    }
    if (ctx.method === 'OPTIONS') {
      // Permissive CORS preflight so the browser-side authClient (running on
      // a different origin during dev) can hit these endpoints. Production
      // sets the same origin via the lobby UI being served from the same
      // host as the server, so this is harmless either way.
      ctx.set('access-control-allow-origin', '*');
      ctx.set('access-control-allow-headers', 'authorization, content-type');
      ctx.set('access-control-allow-methods', 'GET, POST, OPTIONS');
      send(ctx, 204, '');
      return;
    }
    ctx.set('access-control-allow-origin', '*');

    try {
      // Per-IP rate limit applied to POST endpoints (writes).
      // GET /auth/verify is exempt — clients hit it once per page
      // load to refresh creds and refusing to verify a known token
      // would lock the user out.
      if (ctx.method === 'POST') {
        const ip = ctx.ip ?? 'unknown';
        if (!consumeToken(ip)) {
          send(ctx, 429, { error: 'too many auth attempts; try again shortly' });
          return;
        }
      }
      if (ctx.method === 'POST' && path === '/auth/register') {
        const result = await readJsonBody(ctx.req);
        if (!result.ok) {
          send(ctx, 413, { error: 'request body too large' });
          return;
        }
        const body = result.body;
        const username = typeof body.username === 'string' ? body.username : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const user = await register(username, password);
        send(ctx, 200, { user });
        return;
      }
      if (ctx.method === 'POST' && path === '/auth/login') {
        const result = await readJsonBody(ctx.req);
        if (!result.ok) {
          send(ctx, 413, { error: 'request body too large' });
          return;
        }
        const body = result.body;
        const username = typeof body.username === 'string' ? body.username : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const loginResult = await login(username, password);
        send(ctx, 200, loginResult);
        return;
      }
      if (ctx.method === 'GET' && path === '/auth/verify') {
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
        // Return the (possibly-rotated) token so the client can refresh
        // its localStorage entry.
        send(ctx, 200, { user: result.user, token: result.token });
        return;
      }
      send(ctx, 404, { error: 'unknown auth endpoint' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'auth error';
      // Validation / "already taken" / "invalid credentials" all surface as
      // 400 — the browser side renders the message to the user.
      send(ctx, 400, { error: message });
    }
  });
};
