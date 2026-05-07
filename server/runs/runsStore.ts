// Issue 007 — RunsStore seam for run-history persistence.
//
// Mirrors the AccountsStore pattern (`server/auth/accountsStore.ts`):
// the runs module owns the public API (`recordRun`, `listRunsByUser`,
// `personalBest`); this module owns the storage shape so a SQLite
// implementation can swap in via `setRunsStore(...)` without touching
// any caller. The default at boot stays in-memory so unit tests don't
// need a DB.

import { randomUUID } from 'node:crypto';
import type { RunRecord } from './runs.ts';

/** Backing-store contract. Synchronous methods — every implementation
 * keeps row I/O in-process; async semantics live one layer up
 * (`recordRun`, `listRunsByUser`) so the runs module can wrap, log,
 * or batch without rewriting every store.
 *
 * `RunInsert` is `Omit<RunRecord, 'id' | 'createdAt'>` — the store
 * mints the id + timestamp itself so two stores can't disagree on
 * format. */
export interface RunsStore {
  /** Insert a run keyed on `(matchID, userID)`. If a row already
   * exists for that pair, return it unchanged (10.7 idempotency). */
  insertRun(rec: Omit<RunRecord, 'id' | 'createdAt'>): RunRecord;
  /** All runs for a user. The runs module re-sorts after fetching so
   * the store doesn't need to encode the ordering. */
  listByUser(userID: string): RunRecord[];
  /** Test helper — wipe all rows. */
  clear(): void;
  /** Optional. SQLite-backed stores release the file handle here; the
   * memory store is a no-op. Tests call this to swap stores within
   * a single process, especially on Windows where an open SQLite
   * file blocks `rmSync`. */
  close?: () => void;
}

/** In-memory implementation. Original V1 behavior, now factored out
 * so `setRunsStore` can swap a SQLite implementation in production. */
export const createMemoryRunsStore = (): RunsStore => {
  const runs = new Map<string, RunRecord>();
  const byPair = new Map<string, string>();
  const byUser = new Map<string, Set<string>>();
  let insertionSeq = 0;
  const insertionOrder = new Map<string, number>();

  const pairKey = (matchID: string, userID: string): string =>
    `${matchID} ${userID}`;

  return {
    insertRun(rec) {
      const key = pairKey(rec.matchID, rec.userID);
      const existingID = byPair.get(key);
      if (existingID) {
        const existing = runs.get(existingID);
        if (existing) return existing;
      }
      const created: RunRecord = {
        id: randomUUID(),
        userID: rec.userID,
        matchID: rec.matchID,
        outcome: rec.outcome,
        turns: rec.turns,
        createdAt: Date.now(),
      };
      runs.set(created.id, created);
      byPair.set(key, created.id);
      insertionOrder.set(created.id, ++insertionSeq);
      let userSet = byUser.get(rec.userID);
      if (!userSet) {
        userSet = new Set<string>();
        byUser.set(rec.userID, userSet);
      }
      userSet.add(created.id);
      return created;
    },
    listByUser(userID) {
      const ids = byUser.get(userID);
      if (!ids) return [];
      const list: RunRecord[] = [];
      for (const id of ids) {
        const row = runs.get(id);
        if (row) list.push(row);
      }
      list.sort((a, b) => {
        if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
        const ia = insertionOrder.get(a.id) ?? 0;
        const ib = insertionOrder.get(b.id) ?? 0;
        return ib - ia;
      });
      return list;
    },
    clear() {
      runs.clear();
      byPair.clear();
      byUser.clear();
      insertionOrder.clear();
      insertionSeq = 0;
    },
  };
};
