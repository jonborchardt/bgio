// chiefPhase — the start phase of every round.
//
// Only the seat holding the `chief` role is active; they perform the
// chief-only actions (distributions, etc.) and then call the move that
// flips `G.phaseDone = true` to advance into `othersPhase`. The real
// chief-only move that flips that flag lands in 04.2.

import type { PhaseConfig } from 'boardgame.io';
import { Stage } from 'boardgame.io/core';
import type { SettlementState } from '../types.ts';
import { seatOfRole } from '../roles.ts';

export const chiefPhase: PhaseConfig<SettlementState> = {
  start: true,
  next: 'othersPhase',

  // bgio disallows `events.setActivePlayers` from a phase `onBegin`; the
  // canonical place to set per-phase active players is `turn.onBegin`.
  // Stage.NULL is the placeholder "no specific stage" marker — 02.2 fleshes
  // out the real per-phase stage map.
  turn: {
    onBegin: ({ G, events }) => {
      const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
      events.setActivePlayers({ value: { [chiefSeat]: Stage.NULL } });
    },
  },

  endIf: ({ G }) => G.phaseDone === true,
};
