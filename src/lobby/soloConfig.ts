// 11.7 — Solo-mode bot wiring.
//
// `buildBotMap(cfg)` resolves a `SoloConfig` (numPlayers + humanRole) into a
// map from non-human seat -> composed bot function. Each composed bot cycles
// through the roles owned by that seat (per `assignRoles(numPlayers)`) and
// returns the first non-null `MoveCandidate` produced by the per-role bots
// from 11.3-11.6. If every owned role's bot returns null, the composed bot
// returns null too — the caller is expected to flip whatever seat-done flag
// the harness uses (or, in production, the server-side `runBot` worker
// described below decides what to do).
//
// Server-side runBot workers: the production wiring lives in
// 10.9-idle-bot-takeover; that slice already stubs the server-side hook
// (`Server({ bots })` + `match.metadata.bots`) so a single bot infrastructure
// drives both idle-takeover and solo. This module only owns the *map shape*
// and the per-seat composition logic; consuming it is 10.9's job.
//
// V1 wiring note: the bot map is *not yet* attached to the network-mode
// Client in `App.tsx`. The plan calls out that solo runs through the server
// (so single-player runs persist via the accounts system from 10.7), and
// the server-side runBot path is still being filled in. The lobby still
// records `soloMode` + `humanRole` in the match `setupData` so the server
// can spin its bots once the hook is live; the client just forwards the
// config. See the `it.todo` in `tests/lobby/soloConfig.test.ts` for the
// network wiring follow-up.

import type { PlayerID, Role, SettlementState } from '../game/types.ts';
import { assignRoles, rolesAtSeat, seatOfRole } from '../game/roles.ts';
import { chiefBot } from '../game/ai/chiefBot.ts';
import { scienceBot } from '../game/ai/scienceBot.ts';
import { domesticBot } from '../game/ai/domesticBot.ts';
import { foreignBot } from '../game/ai/foreignBot.ts';
import type { MoveCandidate } from '../game/ai/enumerate.ts';
import type { Ctx } from 'boardgame.io';

/** Lobby form payload — what `CreateMatchForm` produces and what the
 * server stashes in `match.setupData` for solo matches. */
export interface SoloConfig {
  numPlayers: 1 | 2 | 3 | 4;
  /** Which role the human plays. The seat that owns this role becomes
   * the human seat; every other seat in `assignRoles(numPlayers)` is
   * driven by a composed bot. */
  humanRole: Role;
}

/** Per-role bot dispatch table. Keep this in lockstep with the four
 * 11.3-11.6 bot exports; new roles would extend both the `Role` union
 * and this map together. */
const ROLE_BOTS: Record<
  Role,
  { play: (state: { G: SettlementState; ctx: Ctx; playerID: PlayerID }) => MoveCandidate | null }
> = {
  chief: chiefBot,
  science: scienceBot,
  domestic: domesticBot,
  foreign: foreignBot,
};

/** State shape passed into a composed bot. Mirrors the per-role bots'
 * input contract so a composed bot is a drop-in for any single-role bot
 * that the server-side runBot worker (10.9) might call. */
export interface ComposedBotState {
  G: SettlementState;
  ctx: Ctx;
  playerID: PlayerID;
}

export type ComposedBot = (state: ComposedBotState) => MoveCandidate | null;

/**
 * Compose a single bot function for `seat` that runs each owned role's
 * per-role bot in turn and returns the first non-null candidate. The
 * iteration order is the role order recorded in
 * `assignRoles(numPlayers)[seat]` — which is canonical (game-design.md
 * §Players, encoded in `src/game/roles.ts`), so behavior is
 * deterministic across invocations.
 */
const composeBotForSeat = (roles: Role[]): ComposedBot => {
  return (state) => {
    for (const role of roles) {
      const bot = ROLE_BOTS[role];
      const action = bot.play(state);
      if (action !== null) return action;
    }
    return null;
  };
};

/**
 * Build the seat -> bot map for a solo match.
 *
 * - Resolves `humanRole` to a seat via `seatOfRole(assignRoles(numPlayers), humanRole)`.
 * - For every *other* seat in the assignment, composes the per-role bots
 *   (chiefBot / scienceBot / domesticBot / foreignBot) that cover that
 *   seat's owned roles.
 * - 1-player solo: human owns all four roles, so the result is the empty map.
 * - 2-player solo: 2 seats, one of which is human and the other gets a
 *   composed 2-role bot.
 * - 3p / 4p solo: every non-human seat gets a per-seat composed bot.
 *
 * Throws if `humanRole` is somehow not held by any seat in the canonical
 * assignment — that would be a programming error, not a user input the
 * lobby form can produce.
 */
export const buildBotMap = (
  cfg: SoloConfig,
): Record<PlayerID, ComposedBot> => {
  const assignments = assignRoles(cfg.numPlayers);
  const humanSeat = seatOfRole(assignments, cfg.humanRole);
  const out: Record<PlayerID, ComposedBot> = {};
  for (const seat of Object.keys(assignments)) {
    if (seat === humanSeat) continue;
    const roles = rolesAtSeat(assignments, seat);
    if (roles.length === 0) continue;
    out[seat] = composeBotForSeat(roles);
  }
  return out;
};
