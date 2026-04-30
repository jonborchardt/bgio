// 10.7 — browser-side auth client.
//
// Thin fetch wrappers around the future server auth endpoints. The V1
// in-memory accounts module (`server/auth/accounts.ts`) ships the
// register / login / verify primitives but is **not yet wired into the
// server's Koa app** — the server-side routes (`POST /auth/register`,
// `POST /auth/login`, `GET /auth/verify`) are documented here as a
// stub contract that a follow-up patch will mount on bgio's `Server`.
// Until then, calls from `<AuthForms>` will get a 404 from the server.
//
// We expose this module ahead of the server wiring so the lobby UI +
// tests can be built in parallel. `vi.fn()`-mocked fetch covers the
// happy path in tests; the live integration test is left as `it.todo`
// in `tests/server/auth.test.ts` (it depends on the wiring that's not
// yet in `server/index.ts`).

import { getServerURL } from '../clientMode.ts';

export interface AuthUser {
  id: string;
  username: string;
  createdAt: number;
}

export interface LoginResult {
  user: AuthUser;
  token: string;
}

const url = (path: string): string => {
  const base = getServerURL().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const postJson = async <T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> => {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `request failed: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Non-JSON error body — fall back to the generic message.
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
};

/** Create a new account on the server. Server validation rules per 10.7
 * (3-20 char username, >= 8 char password) bubble up as Error messages. */
export const register = async (
  username: string,
  password: string,
): Promise<AuthUser> => {
  const data = await postJson<{ user: AuthUser }>('/auth/register', {
    username,
    password,
  });
  return data.user;
};

/** Verify credentials and return a user + token. */
export const login = async (
  username: string,
  password: string,
): Promise<LoginResult> => {
  return postJson<LoginResult>('/auth/login', { username, password });
};

/** Look up the user behind a stored token. Returns `null` for an
 * invalid / expired token (the server returns 401, which we translate
 * to a null result rather than throwing — callers typically want to
 * fall through to the login UI). */
export const verify = async (token: string): Promise<AuthUser | null> => {
  const res = await fetch(url('/auth/verify'), {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`verify failed: ${res.status}`);
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user ?? null;
};
