// chiefPlaceWorker (04.3) — STUB.
//
// The Chief places a worker token on a Domestic-grid building slot. Until
// 06 (Domestic) lands and the real grid + chief.workers slice exists, this
// move short-circuits behind a feature flag (`G._features.workersEnabled`)
// that 06.1's setup will flip to `true` once the grid is built.
//
// Validations (in order):
//   1. caller has a defined playerID (no spectators / unauthenticated)
//   2. caller holds the chief role
//   3. engine is in `chiefPhase`
//   4. feature flag is set — until 06.1, this is the early bail
//   5. (post-flag) chief has at least one worker in reserve
//   6. (post-flag) the requested cell exists in the grid
//   7. (post-flag) the cell is empty (no existing worker)
//
// On success: decrement `G.chief.workers` and stamp the cell with
// `{ ownerSeat: playerID }`. Worker effects on production output land in
// 06.4; this stub only owns placement bookkeeping.
//
// Grid-cell shape note: the plan picks
//   `Record<\`${x},${y}\`, { id; worker: { ownerSeat } | null }>`
// as the simplest stub that lets the validations land. 06.1 will redefine
// `domestic.grid` with the real building shape; the stub deliberately keeps
// the surface tiny so the redefinition is local.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { clearUndoable } from '../../undo.ts';

export const chiefPlaceWorker: Move<SettlementState> = (
  { G, ctx, playerID },
  args: { x: number; y: number },
) => {
  // bgio passes the acting seat as a top-level `playerID`. Spectator /
  // unauthenticated calls arrive as `undefined`.
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  // Caller must hold the chief role.
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('chief')) {
    return INVALID_MOVE;
  }

  // Engine must be in chiefPhase.
  if (ctx.phase !== 'chiefPhase') return INVALID_MOVE;

  // Feature gate: short-circuit until 06.1 ships the real grid + chief
  // worker reserve and flips this flag in setup.
  if (G._features?.workersEnabled !== true) return INVALID_MOVE;

  // Defensive: the flag is on but the chief slice is somehow missing or has
  // no workers in reserve.
  if (!G.chief || G.chief.workers <= 0) return INVALID_MOVE;

  // Defensive: the flag is on but the domestic slice / grid is somehow
  // missing. 06.1 will guarantee this is present whenever the flag is true.
  if (!G.domestic?.grid) return INVALID_MOVE;

  const key = `${args.x},${args.y}`;
  const cell = G.domestic.grid[key];
  if (cell === undefined) return INVALID_MOVE;

  // Cell must be empty — no double-stacking workers in this stub. 06.x may
  // refine this with capacity / migration rules.
  if (cell.worker !== null) return INVALID_MOVE;

  // All checks passed — decrement the reserve and stamp the cell.
  clearUndoable(G);
  G.chief.workers -= 1;
  cell.worker = { ownerSeat: playerID };
};
