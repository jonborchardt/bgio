// endOfRound — bookkeeping phase between rounds.
//
// Runs the round-end hook list (added in 02.5) on entry, then increments
// the round counter on exit and loops back to `chiefPhase`.

import type { PhaseConfig } from 'boardgame.io';
import type { SettlementState } from '../types.ts';

export const endOfRound: PhaseConfig<SettlementState> = {
  next: 'chiefPhase',

  onBegin: ({ G, events }) => {
    // TODO(02.5): run hooks
    // Reset the per-phase progress flags so the next round starts clean.
    G.phaseDone = false;
    G.othersDone = {};
    // Bookkeeping-only phase: hand control back to `next` immediately.
    // bgio's `endIf` is only re-evaluated after moves/events, so we trigger
    // the transition explicitly from `onBegin` — observers never see
    // `phase === 'endOfRound'` in a settled state.
    events.endPhase();
  },

  onEnd: ({ G }) => {
    G.round += 1;
  },
};
