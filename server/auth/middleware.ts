// 10.7 — Koa middleware that resolves a logged-in user from a request.
//
// The lobby + game endpoints are bgio's; once 10.7 server endpoints land,
// we'll mount this middleware on bgio's `Server({ ... }).router` (Koa).
// V1 ships the middleware shape ahead of the wiring so the auth module
// is exercisable in tests and the future glue is a one-line `app.use`.
//
// Reads the auth token from either:
//   - `Authorization: Bearer <token>` header
//   - `bgio_token` cookie
//
// On success, attaches `ctx.state.user` (and the possibly-rotated token
// in `ctx.state.authToken`) and calls `next()`. On failure, sets `401`
// and short-circuits.

import { verify } from './accounts.ts';
import type { User } from './accounts.ts';

/** Minimal Koa-shaped context that we read from / write to. We type
 * just the pieces we touch so the middleware is testable without
 * pulling Koa's `Context` type into the import graph. */
export interface AuthCtx {
  request?: { header?: Record<string, string | string[] | undefined> };
  /** Koa exposes both. We try `request.header` first, then `headers`
   * for environments (e.g. Node http.IncomingMessage) that only set it
   * on the bare object. */
  headers?: Record<string, string | string[] | undefined>;
  cookies?: {
    get: (name: string) => string | undefined;
  };
  status?: number;
  body?: unknown;
  state: {
    user?: User;
    authToken?: string;
    [k: string]: unknown;
  };
}

const readBearer = (
  headers: Record<string, string | string[] | undefined> | undefined,
): string | null => {
  if (!headers) return null;
  const raw = headers.authorization ?? headers.Authorization;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? (m[1]?.trim() ?? null) : null;
};

const readCookie = (ctx: AuthCtx): string | null => {
  if (!ctx.cookies || typeof ctx.cookies.get !== 'function') return null;
  const raw = ctx.cookies.get('bgio_token');
  return raw ? raw : null;
};

/** Koa middleware: requires a valid auth token. */
export const requireAuth = async (
  ctx: AuthCtx,
  next: () => Promise<void>,
): Promise<void> => {
  const headerSource = ctx.request?.header ?? ctx.headers;
  const token = readBearer(headerSource) ?? readCookie(ctx);
  if (!token) {
    ctx.status = 401;
    ctx.body = { error: 'authentication required' };
    return;
  }
  const result = await verify(token);
  if (!result.user) {
    ctx.status = 401;
    ctx.body = { error: 'invalid or expired token' };
    return;
  }
  ctx.state.user = result.user;
  ctx.state.authToken = result.token;
  await next();
};
