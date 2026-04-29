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

import { register, login, verify } from './accounts.ts';

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
  set: (key: string, value: string) => void;
}

interface KoaApp {
  use: (mw: (ctx: KoaCtx, next: () => Promise<void>) => Promise<void> | void) => unknown;
}

const readJsonBody = async (
  req: NodeJS.ReadableStream,
): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => resolve());
    req.on('error', (err: Error) => reject(err));
  });
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
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
      if (ctx.method === 'POST' && path === '/auth/register') {
        const body = await readJsonBody(ctx.req);
        const username = typeof body.username === 'string' ? body.username : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const user = await register(username, password);
        send(ctx, 200, { user });
        return;
      }
      if (ctx.method === 'POST' && path === '/auth/login') {
        const body = await readJsonBody(ctx.req);
        const username = typeof body.username === 'string' ? body.username : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const result = await login(username, password);
        send(ctx, 200, result);
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
