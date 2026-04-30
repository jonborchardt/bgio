// endOfRound — bookkeeping phase between rounds.
//
// Runs the round-end hook list (added in 02.5) on entry, then increments
// the round counter on exit and loops back to `chiefPhase`.

import type { PhaseConfig } from 'boardgame.io';
import type { SettlementState } from '../types.ts';
import { runRoundEndHooks } from '../hooks.ts';

export const endOfRound: PhaseConfig<SettlementState> = {
  next: 'chiefPhase',

  onBegin: ({ G, ctx, events, random }) => {
    // Reset the per-phase progress flags so the next round starts clean.
    G.phaseDone = false;
    G.othersDone = {};
    // Run any role/feature modules that registered round-end hooks.
    // Hooks may mutate G directly (Immer wraps this onBegin) and may use
    // bgio's random plugin via the `random` argument.
    runRoundEndHooks(G, ctx, random);
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
