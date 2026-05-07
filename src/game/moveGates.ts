// Issue 056j — shared move-gate helpers.
//
// The chief's moves gate on `ctx.phase === 'chiefPhase'`; every
// non-chief role's moves gate on `ctx.activePlayers?.[playerID] ===
// '<role>Turn'`. Two different conventions for the same intent
// ("is this seat allowed to act right now?"). Centralizing the
// asymmetry here gives every move body one named helper to call
// and makes the convention searchable.
//
// Today's roles use literal stage names ('chiefTurn' isn't a stage —
// chief acts at phase level). New roles that adopt the activePlayers
// pattern can reach for `isInRoleStage(ctx, playerID, 'newRoleTurn')`.

import type { Ctx } from 'boardgame.io';

/** True when the engine is in `chiefPhase`. The chief's role check
 *  (`rolesAtSeat(...).includes('chief')`) is left to the caller —
 *  this helper is the phase half of the gate. */
export const isChiefActing = (ctx: Ctx): boolean =>
  ctx.phase === 'chiefPhase';

/** True when `playerID` is currently parked in `stage`. Mirrors the
 *  literal `ctx.activePlayers?.[playerID] === '<stage>'` check every
 *  non-chief move spells inline. */
export const isInRoleStage = (
  ctx: Ctx,
  playerID: string,
  stage: string,
): boolean => ctx.activePlayers?.[playerID] === stage;
