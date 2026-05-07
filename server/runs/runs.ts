// 10.7 — run history.
//
// Records the outcome of every game (win turns, time-up rounds taken)
// keyed by user. Issue 007 — storage now flows through a pluggable
// `RunsStore` (`./runsStore.ts`); the in-memory implementation stays
// the boot default so unit tests don't need a DB, and production swaps
// in `createSqliteRunsStore(...)` from `server/index.ts` when
// `STORAGE_KIND=sqlite`.
//
// Idempotency: the record key is `(matchID, userID)`. If `recordRun`
// fires twice for the same pair (e.g. server restart replays the
// `endIf` hook), the second call returns the existing record unchanged.
//
// Defense redesign 1.5 (D25): the legacy `settlementsJoined` score field
// is retired. The score schema may grow new fields (rounds-taken,
// HP-retained, units-alive) once Phase 2.7 wires the boss-resolution
// score in; for now we only keep `outcome` + `turns`.

import { createMemoryRunsStore, type RunsStore } from './runsStore.ts';

export interface RunRecord {
  id: string;
  userID: string;
  matchID: string;
  outcome: 'win' | 'timeUp';
  /** How many turns it took. 0 if not applicable (e.g. timeUp where the
   * cap was reached). */
  turns: number;
  createdAt: number;
}

let store: RunsStore = createMemoryRunsStore();

/** Swap the backing store. Production wires a SQLite-backed store
 * (`./sqliteRunsStore.ts`) at boot when `STORAGE_KIND=sqlite`. */
export const setRunsStore = (next: RunsStore): void => {
  store = next;
};

/** Insert (or look up the existing record for) a run.
 *
 * Idempotent on `(matchID, userID)` — the second call with the same
 * pair returns the original record verbatim. The fields on a duplicate
 * call are ignored, matching what bgio's at-least-once `endIf` replay
 * could deliver. */
export const recordRun = async (
  rec: Omit<RunRecord, 'id' | 'createdAt'>,
): Promise<RunRecord> => store.insertRun(rec);

/** All runs for a user, newest first (by `createdAt`). */
export const listRunsByUser = async (
  userID: string,
): Promise<RunRecord[]> => store.listByUser(userID);

/** Personal best summary used by the win screen (08.5 outcome) line
 * "fastest win: 42 turns — try to beat it".
 *
 * - `fastestWinTurns` = lowest `turns` across `outcome === 'win'`.
 * - `longestTimeUpTurns` = highest `turns` across `outcome === 'timeUp'`
 *   (rounds-survived placeholder while Phase 2.7 score schema lands).
 * Either field is `null` when the user has no run of that kind. */
export const personalBest = async (
  userID: string,
): Promise<{
  fastestWinTurns: number | null;
  longestTimeUpTurns: number | null;
}> => {
  const all = await listRunsByUser(userID);
  let fastestWinTurns: number | null = null;
  let longestTimeUpTurns: number | null = null;
  for (const row of all) {
    if (row.outcome === 'win') {
      if (fastestWinTurns === null || row.turns < fastestWinTurns) {
        fastestWinTurns = row.turns;
      }
    } else if (row.outcome === 'timeUp') {
      if (
        longestTimeUpTurns === null ||
        row.turns > longestTimeUpTurns
      ) {
        longestTimeUpTurns = row.turns;
      }
    }
  }
  return { fastestWinTurns, longestTimeUpTurns };
};

/** Test helper — wipe all run state. */
export const __resetRunsForTest = (): void => {
  store.clear();
};
