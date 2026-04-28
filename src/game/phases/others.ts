// othersPhase — every non-chief seat acts (in parallel, eventually).
//
// 02.2 wires the real per-role stage map: each non-chief seat lands in
// the stage matching its primary non-chief role (science/domestic/foreign);
// the chief seat sits in `done`. The phase ends once every non-chief seat
// has set its `G.othersDone[seat]` flag — the chief stage is `done` purely
// to mark "no further action expected", not to gate the endIf.

import type { PhaseConfig } from 'boardgame.io';
import type { SettlementState } from '../types.ts';
import { seatOfRole } from '../roles.ts';
import { activePlayersForOthers } from './stages.ts';

export const othersPhase: PhaseConfig<SettlementState> = {
  next: 'endOfRound',

  // bgio disallows `events.setActivePlayers` from a phase `onBegin`; the
  // canonical place to set per-phase active players is `turn.onBegin`.
  // The stage map is rebuilt from the live role assignments so it adapts
  // to whatever seating the setup produced.
  turn: {
    onBegin: ({ G, events }) => {
      events.setActivePlayers({ value: activePlayersForOthers(G.roleAssignments) });
    },
  },

  endIf: ({ G }) => {
    const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
    const others = Object.keys(G.roleAssignments).filter(
      (seat) => seat !== chiefSeat,
    );
    // No non-chief seats (1-player game): the phase trivially ends. The real
    // 1-player flow will be revisited when solo support is fleshed out.
    if (others.length === 0) return true;
    const done = G.othersDone ?? {};
    return others.every((seat) => done[seat] === true);
  },
};
