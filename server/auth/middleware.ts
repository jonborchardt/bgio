// 10.7 — Koa middleware that resolves a logged-in user from a request.
//
// The lobby + game endpoints are bgio's; once 10.7 server endpoints land,
// we'll mount this middleware on bgio's `Server({ ... }).router` (Koa).
// V1 ships the middleware shape ahead of the wiring so the auth module
// is exercisable in tests and the future glue is a one-line `app.use`.
//
// Reads the auth token from `Authorization: Bearer <token>`. On
// success, attaches `ctx.state.user` (and the possibly-rotated token
// in `ctx.state.authToken`) and calls `next()`. On failure, sets
// `401` and short-circuits.
//
// Issue 052 — the older `bgio_token` cookie fallback was removed. No
// route has ever set the cookie (login / verify return the token in
// the JSON body and the SPA stores it in localStorage), so the read
// branch was dead and a footgun for future contributors. If the SPA
// switches to HTTP-only cookies down the line, that change adds
// both the Set-Cookie on login AND the cookie read here.

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

/** Koa middleware: requires a valid auth token. */
export const requireAuth = async (
  ctx: AuthCtx,
  next: () => Promise<void>,
): Promise<void> => {
  const headerSource = ctx.request?.header ?? ctx.headers;
  const token = readBearer(headerSource);
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
