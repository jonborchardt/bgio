// othersPhase — every non-chief seat acts (in parallel, eventually).
//
// 02.2 wires the real per-role stage map: each non-chief seat lands in
// the stage matching its primary non-chief role (science/domestic/defense);
// the chief seat sits in `done`. The phase ends once every non-chief seat
// has set its `G.othersDone[seat]` flag — the chief stage is `done` purely
// to mark "no further action expected", not to gate the endIf.
//
// `turn.onBegin` also runs the **in→stash transfer**: every non-chief
// seat's `in` bag (just-distributed by the chief) is drained into their
// own `stash` so spend moves (Science contribute, Domestic buy, Defense
// future actions) read from one canonical pool.
//
// After the in→stash sweep, every domestic seat auto-produces via
// `runProduceForSeat`. Produce is deterministic and decision-free, so it
// runs as engine plumbing rather than a player-driven button — buys made
// this turn are excluded (the snapshot is taken before the seat acts),
// matching the prior balance.

import type { PhaseConfig } from 'boardgame.io';
import type { SettlementState } from '../types.ts';
import { rolesAtSeat, seatOfRole } from '../roles.ts';
import { takeIntoStash } from '../resources/playerMat.ts';
import { runProduceForSeat } from '../roles/domestic/produce.ts';
import { activePlayersForOthers } from './stages.ts';

export const othersPhase: PhaseConfig<SettlementState> = {
  next: 'endOfRound',

  // bgio disallows `events.setActivePlayers` from a phase `onBegin`; the
  // canonical place to set per-phase active players is `turn.onBegin`.
  // The stage map is rebuilt from the live role assignments so it adapts
  // to whatever seating the setup produced.
  turn: {
    onBegin: ({ G, events }) => {
      // In→stash: every non-chief seat's `in` bag empties into their
      // `stash`. Empty `in` bags are no-ops. The transfer is automatic
      // (not a player-driven move) because there's no decision involved
      // — the rules just say "you take what the chief gave you before
      // you act".
      if (G.mats !== undefined) {
        for (const seat of Object.keys(G.mats)) {
          const mat = G.mats[seat];
          if (mat === undefined) continue;
          takeIntoStash(mat);
        }
      }

      for (const seat of Object.keys(G.roleAssignments)) {
        if (!rolesAtSeat(G.roleAssignments, seat).includes('domestic')) continue;
        runProduceForSeat(G, seat);
      }

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
