// 10.7 — accounts: register / login / verify against a pluggable store.
//
// V1 shipped a Map-backed in-memory store inline; the 10.7 follow-up
// (this rewrite) extracts the storage seam into `./accountsStore.ts` so
// production can swap in the SQLite-backed store from
// `./sqliteAccountsStore.ts`. The default at boot stays in-memory so
// nothing changes for tests / ad-hoc dev runs that don't opt in.
//
// Tokens:
//   - 32 random bytes, hex-encoded (64 chars).
//   - 24h expiry from issue.
//   - On `verify`, if the token is older than 1h we rotate (mint a new
//     token, invalidate the old). The plan calls for this without
//     specifying a particular rotation API — `verify` just returns the
//     `User` and rotation is internal book-keeping.
//
// Validation rules per plan: 3-20 chars `[A-Za-z0-9_-]` for username
// (case-insensitive uniqueness), >= 8 chars for password.

import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwordHash.ts';
import {
  type AccountsStore,
  createMemoryAccountsStore,
} from './accountsStore.ts';

export interface User {
  /** uuid v4 */
  id: string;
  /** Stored as the user provided (preserves their preferred casing). */
  username: string;
  /** Epoch ms. */
  createdAt: number;
}

/** 24h. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Tokens older than this on `verify` get rotated. */
const TOKEN_ROTATE_AGE_MS = 60 * 60 * 1000;

const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
const MIN_PASSWORD_LEN = 8;

let store: AccountsStore = createMemoryAccountsStore();

/** Swap the backing store. Call once at server boot — production wires
 * the SQLite-backed store from `./sqliteAccountsStore.ts`. Tests can
 * also call this to pin a fresh store per `describe` block. */
export const setAccountsStore = (next: AccountsStore): void => {
  store = next;
};

const newToken = (): string => randomBytes(32).toString('hex');

const issueToken = (userID: string, now: number): string => {
  const token = newToken();
  store.insertToken(token, {
    userID,
    issuedAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  });
  return token;
};

const validateUsername = (username: string): void => {
  if (!USERNAME_RE.test(username)) {
    throw new Error(
      'username must be 3-20 chars, allowed characters: A-Z, a-z, 0-9, _, -',
    );
  }
};

const validatePassword = (password: string): void => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LEN) {
    throw new Error('password must be at least 8 characters');
  }
};

const publicProjection = (row: {
  id: string;
  username: string;
  createdAt: number;
}): User => ({ id: row.id, username: row.username, createdAt: row.createdAt });

/** Create a new user. Trims `username`. Throws on validation failure or
 * if the username (case-insensitive) is already taken. */
export const register = async (
  username: string,
  password: string,
): Promise<User> => {
  const trimmed = (username ?? '').trim();
  validateUsername(trimmed);
  validatePassword(password);
  const lower = trimmed.toLowerCase();
  if (store.findUserByLower(lower) !== undefined) {
    throw new Error('username already taken');
  }
  const passwordHash = await hashPassword(password);
  const row = {
    id: randomUUID(),
    username: trimmed,
    createdAt: Date.now(),
    passwordHash,
  };
  store.insertUser(row);
  return publicProjection(row);
};

/** Verify a username/password pair and mint a fresh token. */
export const login = async (
  username: string,
  password: string,
): Promise<{ user: User; token: string }> => {
  const trimmed = (username ?? '').trim();
  const lower = trimmed.toLowerCase();
  const row = store.findUserByLower(lower);
  if (!row) {
    throw new Error('invalid credentials');
  }
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) {
    throw new Error('invalid credentials');
  }
  const now = Date.now();
  const token = issueToken(row.id, now);
  return {
    user: publicProjection(row),
    token,
  };
};

/** Result of `verify`. `null` user means invalid/expired token. The
 * `token` field carries the (possibly-rotated) token the caller should
 * use going forward. */
export interface VerifyResult {
  user: User | null;
  /** Either the original token (still fresh) or a freshly-rotated one
   * if the original was older than `TOKEN_ROTATE_AGE_MS`. Always equal
   * to the input when `user === null`. */
  token: string;
}

/** Look up a user by token. Rotates the token if older than 1h. */
export const verify = async (token: string): Promise<VerifyResult> => {
  if (!token) return { user: null, token };
  const row = store.findToken(token);
  if (!row) return { user: null, token };
  const now = Date.now();
  if (row.expiresAt <= now) {
    store.deleteToken(token);
    return { user: null, token };
  }
  // Look up the underlying user. Could have been removed in tests
  // (__resetAccountsForTest); treat that as an invalid token.
  const userRow = store.findUserById(row.userID);
  if (!userRow) {
    store.deleteToken(token);
    return { user: null, token };
  }
  let outToken = token;
  if (now - row.issuedAt > TOKEN_ROTATE_AGE_MS) {
    // Rotate: issue a new token and invalidate the old.
    store.deleteToken(token);
    outToken = issueToken(row.userID, now);
  }
  return {
    user: publicProjection(userRow),
    token: outToken,
  };
};

/** Test helper — wipe all backing-store state. Tests call this in
 * `beforeEach` to avoid leaking users / tokens between cases. */
export const __resetAccountsForTest = (): void => {
  store.clear();
};

/** Test helper — backdate a token's `issuedAt` (and `expiresAt`,
 * preserving the original TTL window) so the rotation / expiry
 * branches in `verify` can be exercised deterministically. Returns
 * `false` if the token is unknown. */
export const __backdateTokenForTest = (
  token: string,
  ageMs: number,
): boolean => store.backdateToken(token, ageMs);
