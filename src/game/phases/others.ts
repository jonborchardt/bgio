// othersPhase — every non-chief seat acts (in parallel, eventually).
//
// Each non-chief seat sits in a placeholder `waiting` stage until 02.2
// fleshes out the real per-role stage map. The phase ends once every
// non-chief seat has set its `G.othersDone[seat]` flag.

import type { PhaseConfig } from 'boardgame.io';
import type { SettlementState } from '../types.ts';
import { seatOfRole } from '../roles.ts';

export const othersPhase: PhaseConfig<SettlementState> = {
  next: 'endOfRound',

  // bgio disallows `events.setActivePlayers` from a phase `onBegin`; the
  // canonical place to set per-phase active players is `turn.onBegin`.
  // The map is rebuilt from the live role assignments so it adapts to
  // whatever seating the setup produced.
  turn: {
    onBegin: ({ G, events }) => {
      const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
      const value: Record<string, string> = {};
      for (const seat of Object.keys(G.roleAssignments)) {
        if (seat === chiefSeat) continue;
        value[seat] = 'waiting';
      }
      events.setActivePlayers({ value });
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
