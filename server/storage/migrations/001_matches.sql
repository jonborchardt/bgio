-- 13.3 — bgio match storage schema.
--
-- One row per match. `setup_data`, `metadata`, and `state` are JSON-encoded
-- payloads (TEXT) because bgio's `Async` interface hands us opaque objects
-- and we don't want to leak structure into the schema. Per-match log rows
-- live in their own table keyed by (match_id, idx) so we can range-query
-- a slice without rewriting the whole match row on every move.
--
-- Migrations are idempotent (`IF NOT EXISTS`) so reruns at boot are safe.

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  setup_data TEXT NOT NULL,
  metadata TEXT NOT NULL,
  state TEXT NOT NULL,
  initial_state TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS matches_updated_at ON matches(updated_at DESC);

CREATE TABLE IF NOT EXISTS log (
  match_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  entry TEXT NOT NULL,
  PRIMARY KEY (match_id, idx),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
