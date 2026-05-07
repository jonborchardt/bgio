// Project bgio's `client.log` (LogEntry[]) into renderable
// `ActivityEntry`s. Walks the log forward, runs each MAKE_MOVE entry's
// args through the formatter table in `formatters.ts`, and computes a
// rolling round counter from phase transitions.
//
// Round attribution: `client.log` carries each entry's `phase` at the
// time it was recorded. We track previous-entry-phase and increment the
// round whenever we see a transition out of `endOfRound`, so the
// "Round N" dividers match what `G.round` was when the move ran.

import type { LogEntry } from 'boardgame.io';
import type { SettlementState, PlayerID } from '../../game/types.ts';
import type { ActivityEntry } from './types.ts';
import { FORMATTERS } from './formatters.ts';

interface MakeMovePayload {
  type?: string;
  args?: ReadonlyArray<unknown>;
  playerID?: PlayerID;
}

const isMakeMove = (
  entry: LogEntry,
): { payload: MakeMovePayload; phase?: string } | null => {
  const a = (entry as unknown as { action?: { type?: string; payload?: MakeMovePayload } }).action;
  if (!a || a.type !== 'MAKE_MOVE' || !a.payload) return null;
  const phase = (entry as unknown as { phase?: string }).phase;
  return { payload: a.payload, phase };
};

const phaseOf = (entry: LogEntry): string | undefined =>
  (entry as unknown as { phase?: string }).phase;

export const projectLog = (
  log: ReadonlyArray<LogEntry>,
  G: SettlementState,
): ActivityEntry[] => {
  const out: ActivityEntry[] = [];
  let round = 1;
  let prevPhase: string | undefined;

  for (const entry of log) {
    const phase = phaseOf(entry);
    if (prevPhase === 'endOfRound' && phase !== 'endOfRound') round += 1;
    prevPhase = phase;

    const move = isMakeMove(entry);
    if (move === null) continue;
    const moveName = move.payload.type;
    if (moveName === undefined) continue;

    const fmt = FORMATTERS[moveName];
    if (fmt === undefined) continue;

    const args = move.payload.args ?? [];
    const result = fmt(args, G);
    if (result === null) continue;

    out.push({
      round,
      seat: move.payload.playerID,
      role: result.role,
      parts: result.parts,
    });
  }

  return out;
};
