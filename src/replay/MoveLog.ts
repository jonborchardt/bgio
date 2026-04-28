// 12.3 — Move-log envelope, persistence, and headless replay driver.
//
// **bgio-first.** The source of truth for "what happened in the match"
// is bgio's own `client.log` (a `LogEntry[]`). We don't intercept
// move dispatch; we read bgio's log and serialize it. Replay drives a
// headless `Client` from `boardgame.io/client` through the same
// entries — bgio is both the recorder and the player.
//
// V1 storage is `localStorage`-only with a 5-match LRU policy. The
// server-side endpoint (`GET /games/settlement/:matchID/log`) is
// reserved for 13.x; `fetchLogFromServer` is the client-side fetch
// half so the rest of this module is wired today.

import { Client as HeadlessClient } from 'boardgame.io/client';
import type { LogEntry } from 'boardgame.io';
import { Settlement, type SettlementState } from '../game/index.ts';

/** Persisted shape for a recorded match. Thin envelope around bgio's
 *  `LogEntry[]` — we never re-shape entries, we just stash the metadata
 *  needed to spin up the same `Client` for replay. */
export interface MoveLog {
  matchID: string;
  numPlayers: 1 | 2 | 3 | 4;
  /** Whatever the lobby passed to `createMatch.setupData`. The shape is
   *  out of our hands — bgio threads it back to `setup(ctx, setupData)`. */
  setupData: unknown;
  /** bgio's authoritative move log. We use bgio's `LogEntry` directly so
   *  there's no parallel definition to drift. */
  entries: LogEntry[];
}

// Loose structural shape we expect from a bgio Client (React or headless).
// Keeping it `unknown`-friendly avoids importing bgio's internal client
// types — those aren't part of the public API surface.
interface ClientLike {
  log?: LogEntry[];
  matchID?: string;
  // The headless client also exposes `getState().log` in some versions.
  getState?: () => { log?: LogEntry[] } | null;
}

/** Read `client.log` and wrap it in a `MoveLog`. The match metadata
 *  (`matchID`, `numPlayers`, `setupData`) is supplied by the caller —
 *  the bgio `Client` doesn't always expose these synchronously, and
 *  asking the caller is simpler than guessing. */
export const snapshotLog = (
  client: ClientLike,
  meta: {
    matchID: string;
    numPlayers: 1 | 2 | 3 | 4;
    setupData?: unknown;
  },
): MoveLog => {
  const direct = client.log;
  const fromState = client.getState?.()?.log;
  const entries = direct ?? fromState ?? [];
  return {
    matchID: meta.matchID,
    numPlayers: meta.numPlayers,
    setupData: meta.setupData,
    entries: [...entries],
  };
};

/** Drive a headless `Client` through the recorded log and return the
 *  final `G` state. V1 implementation: dispatch each log action through
 *  `client.store.dispatch`. Some entries in `LogEntry[]` are non-action
 *  metadata (`automatic` / `phaseTransition`); we skip those silently
 *  since bgio replays them on its own as a side-effect of dispatching
 *  the player-driven moves around them. */
export const replay = (log: MoveLog): SettlementState => {
  const seededGame = { ...Settlement } as typeof Settlement;
  const client = HeadlessClient<SettlementState>({
    game: seededGame,
    numPlayers: log.numPlayers,
  });
  client.start();

  // bgio's `Client` exposes the redux-style `store` in 0.50.x. We dispatch
  // each entry's `action` shape through it. The shape of `LogEntry.action`
  // is bgio's internal action type, which `store.dispatch` accepts.
  const store = (
    client as unknown as {
      store?: { dispatch: (action: unknown) => void };
    }
  ).store;
  if (store) {
    for (const entry of log.entries) {
      const action = (entry as unknown as { action?: unknown }).action;
      if (action) store.dispatch(action);
    }
  }

  // Pull final state.
  const state = client.getState() as { G: SettlementState } | null;
  if (!state) {
    throw new Error('replay: client.getState() returned null after dispatch');
  }
  return state.G;
};

// ---------------------------------------------------------------------------
// localStorage persistence (12.3 §Steps 2)
// ---------------------------------------------------------------------------

/** Storage-key prefix. Listed alongside the live key namespace under
 *  `lobby/credentials.ts` — keep the prefix in sync with both. */
const KEY_PREFIX = 'settlement.replay.';

/** LRU eviction count. The plan says "keep last 5 matches plus current". */
const MAX_LOGS = 5;

/** Safe access to `localStorage` — returns `null` in environments
 *  without a `window` (Node, headless tests that don't bind jsdom). */
const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Persist the log under `settlement.replay.<matchID>`. If we'd push
 *  past `MAX_LOGS` entries total, we evict the least-recently-written
 *  entry (LRU, with `Date.now()` as the recency key). */
export const saveLogToLocalStorage = (log: MoveLog): void => {
  const ls = getStorage();
  if (!ls) return;
  const key = KEY_PREFIX + log.matchID;
  const payload = JSON.stringify({ savedAt: Date.now(), log });
  try {
    ls.setItem(key, payload);
  } catch {
    // Quota exceeded or storage disabled — silently skip rather than
    // crash the running game.
    return;
  }
  evictExcess(ls);
};

/** Load a previously-saved log by matchID. Returns `null` if missing or
 *  malformed. */
export const loadLogFromLocalStorage = (matchID: string): MoveLog | null => {
  const ls = getStorage();
  if (!ls) return null;
  const raw = ls.getItem(KEY_PREFIX + matchID);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { log?: MoveLog };
    return parsed.log ?? null;
  } catch {
    return null;
  }
};

/** List every persisted matchID. Used by debug tooling and by the
 *  eviction policy. */
export const listLogs = (): string[] => {
  const ls = getStorage();
  if (!ls) return [];
  const out: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith(KEY_PREFIX)) {
      out.push(k.slice(KEY_PREFIX.length));
    }
  }
  return out;
};

/** Internal: drop the oldest entries until we're back at `MAX_LOGS`. */
const evictExcess = (ls: Storage): void => {
  const entries: { matchID: string; savedAt: number }[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    const raw = ls.getItem(k);
    if (!raw) continue;
    let savedAt = 0;
    try {
      const parsed = JSON.parse(raw) as { savedAt?: number };
      savedAt = parsed.savedAt ?? 0;
    } catch {
      // Treat corrupt entries as oldest so they get evicted first.
    }
    entries.push({ matchID: k.slice(KEY_PREFIX.length), savedAt });
  }
  if (entries.length <= MAX_LOGS) return;
  entries.sort((a, b) => a.savedAt - b.savedAt);
  const toDrop = entries.slice(0, entries.length - MAX_LOGS);
  for (const e of toDrop) {
    ls.removeItem(KEY_PREFIX + e.matchID);
  }
};

// ---------------------------------------------------------------------------
// Server fetch (12.3 §Steps 5) — client half only.
// ---------------------------------------------------------------------------

/** Fetch a match log from the bgio server's replay endpoint. The
 *  endpoint itself (`GET /games/settlement/:matchID/log`) is reserved
 *  for 13.x; this client-side helper is wired today so the UI doesn't
 *  need a parallel implementation when the server lands. */
export const fetchLogFromServer = async (
  serverUrl: string,
  matchID: string,
  authToken: string,
): Promise<MoveLog> => {
  const base = serverUrl.replace(/\/+$/, '');
  const url = `${base}/games/settlement/${encodeURIComponent(matchID)}/log`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    throw new Error(
      `fetchLogFromServer: ${res.status} ${res.statusText} for ${url}`,
    );
  }
  return (await res.json()) as MoveLog;
};

// Storage-key prefix is exported for tests that want to clear the slot
// without re-implementing the convention.
export const REPLAY_KEY_PREFIX = KEY_PREFIX;
