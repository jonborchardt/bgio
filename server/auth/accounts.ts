// 10.7 — accounts: register / login / verify against an in-memory store.
//
// **V1 deviation:** the plan wants users + tokens persisted in SQLite
// (per the schema in 13.3). Our V1 keeps SQLite deferred — see
// `passwordHash.ts` for the rationale — so we live in plain JS Maps for
// now. The shape of `User` and the public surface match the plan
// exactly so the SQLite swap is a private-only refactor.
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

export interface User {
  /** uuid v4 */
  id: string;
  /** Stored as the user provided (preserves their preferred casing). */
  username: string;
  /** Epoch ms. */
  createdAt: number;
}

interface UserRow extends User {
  passwordHash: string;
}

interface TokenRow {
  userID: string;
  /** Epoch ms when this token was issued. Used to decide rotation. */
  issuedAt: number;
  /** Epoch ms when this token stops being valid. */
  expiresAt: number;
}

/** 24h. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Tokens older than this on `verify` get rotated. */
const TOKEN_ROTATE_AGE_MS = 60 * 60 * 1000;

const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
const MIN_PASSWORD_LEN = 8;

// Keyed by username.toLowerCase() — `username TEXT UNIQUE COLLATE NOCASE`
// in the future SQLite table. The lowercase key matches that semantics.
const usersByLower = new Map<string, UserRow>();
const tokens = new Map<string, TokenRow>();

const newToken = (): string => randomBytes(32).toString('hex');

const issueToken = (userID: string, now: number): string => {
  const token = newToken();
  tokens.set(token, {
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
  if (usersByLower.has(lower)) {
    throw new Error('username already taken');
  }
  const passwordHash = await hashPassword(password);
  const row: UserRow = {
    id: randomUUID(),
    username: trimmed,
    createdAt: Date.now(),
    passwordHash,
  };
  usersByLower.set(lower, row);
  // Return the public projection (without passwordHash).
  return { id: row.id, username: row.username, createdAt: row.createdAt };
};

/** Verify a username/password pair and mint a fresh token. */
export const login = async (
  username: string,
  password: string,
): Promise<{ user: User; token: string }> => {
  const trimmed = (username ?? '').trim();
  const lower = trimmed.toLowerCase();
  const row = usersByLower.get(lower);
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
    user: { id: row.id, username: row.username, createdAt: row.createdAt },
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
  const row = tokens.get(token);
  if (!row) return { user: null, token };
  const now = Date.now();
  if (row.expiresAt <= now) {
    tokens.delete(token);
    return { user: null, token };
  }
  // Look up the underlying user. The user could have been removed in
  // tests (__resetAccountsForTest) — treat that as an invalid token.
  let userRow: UserRow | undefined;
  for (const candidate of usersByLower.values()) {
    if (candidate.id === row.userID) {
      userRow = candidate;
      break;
    }
  }
  if (!userRow) {
    tokens.delete(token);
    return { user: null, token };
  }
  let outToken = token;
  if (now - row.issuedAt > TOKEN_ROTATE_AGE_MS) {
    // Rotate: issue a new token and invalidate the old. The same userID
    // gets a fresh issuedAt + expiresAt window.
    tokens.delete(token);
    outToken = issueToken(row.userID, now);
  }
  return {
    user: {
      id: userRow.id,
      username: userRow.username,
      createdAt: userRow.createdAt,
    },
    token: outToken,
  };
};

/** Test helper — wipe all in-memory state. Tests call this in
 * `beforeEach` to avoid leaking users / tokens between cases. */
export const __resetAccountsForTest = (): void => {
  usersByLower.clear();
  tokens.clear();
};

/** Test helper — backdate a token's `issuedAt` (and `expiresAt`,
 * preserving the original TTL window) so the rotation / expiry
 * branches in `verify` can be exercised deterministically. Returns
 * `false` if the token is unknown. */
export const __backdateTokenForTest = (
  token: string,
  ageMs: number,
): boolean => {
  const row = tokens.get(token);
  if (!row) return false;
  row.issuedAt -= ageMs;
  row.expiresAt -= ageMs;
  return true;
};
