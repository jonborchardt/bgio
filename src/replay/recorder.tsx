// 12.3 — Recorder provider for the bgio Client.
//
// V1 implementation: a tiny `useEffect` that snapshots `client.log` and
// writes it to localStorage on every render. The plan calls for
// `client.subscribe(...)` so the recorder fires on every state update;
// in React, mounting the BoardProps-receiving component is exactly
// "every state update" because bgio re-renders the board after every
// move. So the simpler effect form is equivalent for our needs.
//
// We deliberately don't intercept move dispatch (per CLAUDE.md). bgio's
// own log is the source of truth — we only persist it.

import { useEffect } from 'react';
import { snapshotLog, saveLogToLocalStorage } from './MoveLog.ts';
import type { MoveLog } from './MoveLog.ts';

// We type `client` loosely — the BoardProps-bound bgio Client doesn't
// hand the `log` directly; we read whatever fields are present and
// fall back to the empty-log path if nothing useful is there.
interface ClientLike {
  log?: MoveLog['entries'];
  matchID?: string;
}

export interface RecorderProps {
  /** The bgio React Client instance. Pass through `client` from the
   *  enclosing `<Client>`-rendered component. May be `undefined` when
   *  used in headless test contexts; the effect skips silently. */
  client?: ClientLike;
  /** Match metadata. The bgio Client doesn't always synchronously
   *  expose `numPlayers` / `setupData`, so the parent passes them in. */
  matchID?: string;
  numPlayers?: 1 | 2 | 3 | 4;
  setupData?: unknown;
}

/** Persists the current move log to localStorage on every render of
 *  the parent. Renders nothing — it's effect-only.
 *
 *  Usage:
 *    ```tsx
 *    <Recorder client={client} matchID={id} numPlayers={4} />
 *    ```
 */
export const Recorder = (props: RecorderProps): null => {
  useEffect(() => {
    const { client, matchID, numPlayers } = props;
    if (!client || !matchID || !numPlayers) return;
    const log = snapshotLog(client, {
      matchID,
      numPlayers,
      setupData: props.setupData,
    });
    saveLogToLocalStorage(log);
  });
  return null;
};

export default Recorder;
