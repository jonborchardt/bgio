// chiefPhase — the start phase of every round.
//
// The seat holding the `chief` role drives the phase's gameplay
// (distributions, end-phase). Every other seat is also marked active
// in `Stage.NULL` so they can call the stage-agnostic `requestHelp`
// move while they wait — each "real" move self-gates by role, so
// non-chief seats can't actually drive chief actions.
//
// `turn.onBegin` also runs the **out-sweep**: every non-chief seat's
// `out` bag (where their production from last round was deposited) is
// drained into `G.bank` so the chief sees the freshly-produced
// resources before they decide on distribution.

import type { PhaseConfig } from 'boardgame.io';
import { Stage } from 'boardgame.io/core';
import type { SettlementState } from '../types.ts';
import { drainBag } from '../resources/playerMat.ts';
import { appendBankLog } from '../resources/bankLog.ts';
import { RESOURCES } from '../resources/types.ts';

export const chiefPhase: PhaseConfig<SettlementState> = {
  start: true,
  next: 'othersPhase',

  // bgio disallows `events.setActivePlayers` from a phase `onBegin`; the
  // canonical place to set per-phase active players is `turn.onBegin`.
  // Stage.NULL is the placeholder "no specific stage" marker — 02.2 fleshes
  // out the real per-phase stage map.
  turn: {
    onBegin: ({ G, events }) => {
      // Per-round chief stipend: a small fixed gold income to the bank so
      // the chief always has *something* to distribute, independent of
      // production/battle outcomes. Default = 2 (see setup.ts
      // CHIEF_STIPEND_DEFAULT); 0 disables. Skipped on round 0 because
      // `setup` already seeded the starting bank.
      const stipend = G.chiefStipend ?? 0;
      if (stipend > 0 && G.round > 0) {
        G.bank.gold += stipend;
        appendBankLog(G, 'stipend', { gold: stipend }, 'Per-round income');
      }

      // Out-sweep: pour every non-chief seat's `out` bag into `G.bank` and
      // log a per-seat entry so the bank tooltip can show the sweep
      // origin. Empty `out` bags are no-ops (`appendBankLog` ignores empty
      // deltas) so the first chief turn (round 0, no production yet) just
      // logs nothing.
      if (G.mats !== undefined) {
        for (const seat of Object.keys(G.mats).sort()) {
          const mat = G.mats[seat];
          if (mat === undefined) continue;
          const moved = drainBag(mat.out);
          // `drainBag` already returns only non-zero entries; deposit each
          // into the bank.
          let any = false;
          for (const r of RESOURCES) {
            const amt = moved[r] ?? 0;
            if (amt > 0) {
              G.bank[r] += amt;
              any = true;
            }
          }
          if (any) {
            appendBankLog(G, 'sweep', moved, `from seat ${seat}`);
          }
        }
      }

      const value: Record<string, typeof Stage.NULL> = {};
      for (const seat of Object.keys(G.roleAssignments)) {
        value[seat] = Stage.NULL;
      }
      events.setActivePlayers({ value });
    },
  },

  endIf: ({ G }) => G.phaseDone === true,
};
