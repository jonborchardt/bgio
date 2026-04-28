-- 13.3 + 10.7 — accounts, auth tokens, run history.
--
-- The accounts module (server/auth/accounts.ts) is currently in-memory in
-- V1; this migration lands the schema that the SQLite swap will use, so the
-- public API of accounts.ts can flip to the database in a follow-up without
-- touching callers. `users.username` uses NOCASE collation so the case-
-- insensitive uniqueness rule from 10.7 is enforced by the index, not by
-- application code that could drift.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_tokens_by_user ON auth_tokens(user_id);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  outcome TEXT NOT NULL,            -- 'win' | 'timeUp'
  turns INTEGER NOT NULL,
  settlements_joined INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (match_id, user_id)        -- 10.7 idempotency
);

CREATE INDEX IF NOT EXISTS runs_by_user ON runs(user_id, created_at DESC);
