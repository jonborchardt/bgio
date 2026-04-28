// scienceComplete (05.3) — the Science role completes a science card whose
// `paid` ledger covers its `cost`. Per game-design.md §Science:
//   - Resources move from the paid ledger into the bank (they are spent).
//   - The 4 face-down tech cards under the science card are distributed by
//     color: red → Foreign, gold → Chief, green → Domestic, blue → Science.
//   - At most one science card may be completed per round (per-round
//     counter, reset by the `science:reset-completions` hook at endOfRound).

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import type { TechnologyDef } from '../../../data/schema.ts';
import { RESOURCES } from '../../resources/types.ts';
import type { ResourceBag } from '../../resources/types.ts';
import { canAfford } from '../../resources/bag.ts';
import { transfer } from '../../resources/bank.ts';
import { rolesAtSeat } from '../../roles.ts';

export const scienceComplete: Move<SettlementState> = (
  { G, ctx, playerID },
  cardID: string,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  // Caller must hold the science role.
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) {
    return INVALID_MOVE;
  }

  // Stage check (mirrors `scienceContribute` — keeps event-stage interrupts
  // from sneaking a completion through).
  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return INVALID_MOVE;

  const science = G.science;
  if (science === undefined) return INVALID_MOVE;

  const card = science.grid.flat().find((c) => c.id === cardID);
  if (card === undefined) return INVALID_MOVE;

  if (science.completed.includes(cardID)) return INVALID_MOVE;

  // Paid ledger must cover the cost.
  const paid = science.paid[cardID]!;
  if (!canAfford(paid, card.cost)) return INVALID_MOVE;

  // Per-round cap: only 1 completion per round.
  if (science.perRoundCompletions >= 1) return INVALID_MOVE;

  // -- All checks passed; mutate. ---------------------------------------

  // Mark complete and bump the per-round counter.
  science.completed.push(cardID);
  science.perRoundCompletions += 1;

  // Move every non-zero resource in the paid ledger to the bank. We sweep
  // the entire paid bag rather than just `card.cost` — the contribute move
  // caps amounts so paid should never exceed cost, but moving the full
  // ledger keeps us robust against any accidental over-contribution.
  const sweep: Partial<ResourceBag> = {};
  for (const r of RESOURCES) {
    if (paid[r] > 0) sweep[r] = paid[r];
  }
  transfer(paid, G.bank, sweep);
  // After the transfer the paid bag is all-zero; reassign to a fresh empty
  // bag for clarity (and to detach any stale references).
  science.paid[cardID] = {
    gold: 0,
    wood: 0,
    stone: 0,
    steel: 0,
    horse: 0,
    food: 0,
    production: 0,
    science: 0,
    happiness: 0,
    worker: 0,
  };

  // Distribute the 4 tech cards under this science card to the right hand
  // by color. We push to the per-role slice on G — whichever seat holds
  // that role owns it (per the 1p/2p/3p/4p assignment table). Initialize
  // hand fields lazily because earlier setups may not have reserved them.
  const techStack: TechnologyDef[] = science.underCards[cardID] ?? [];
  switch (card.color) {
    case 'red': {
      // Foreign role. ForeignState.hand is currently typed as `unknown[]`;
      // 07.4 will refine it. Push tech cards through that loose slot — the
      // type-level reconciliation happens once 07.4 lands the proper hand
      // shape. Casting to `unknown` keeps strict mode happy without
      // committing to an intermediate hand type that 07.4 will rework.
      if (G.foreign === undefined) {
        // Defensive: if the Foreign slice was somehow not initialized,
        // there's nowhere to deliver the cards. Throw loudly — this is a
        // logic bug, not a player-recoverable INVALID_MOVE.
        throw new Error(
          'scienceComplete: G.foreign is undefined; cannot deliver red tech cards',
        );
      }
      for (const tech of techStack) {
        (G.foreign.hand as unknown as TechnologyDef[]).push(tech);
      }
      break;
    }
    case 'gold': {
      // Chief role. The chief slice may not exist in older fixtures; if
      // it's missing we initialize it with the canonical workers=0
      // default so the tech cards have a home.
      if (G.chief === undefined) {
        G.chief = { workers: 0, hand: [] };
      } else if (G.chief.hand === undefined) {
        G.chief.hand = [];
      }
      G.chief.hand!.push(...techStack);
      break;
    }
    case 'green': {
      // Domestic role. Older fixtures (pre-06.1) may have no domestic
      // slice at all — initialize a minimal shell with an empty grid.
      if (G.domestic === undefined) {
        G.domestic = { grid: {}, hand: [] };
      } else if (G.domestic.hand === undefined) {
        G.domestic.hand = [];
      }
      G.domestic.hand!.push(...techStack);
      break;
    }
    case 'blue': {
      // Science role. ScienceState.hand was added in 05.3.
      science.hand.push(...techStack);
      break;
    }
    default: {
      // Data error — the four colors above exhaust the legal set per the
      // schema. Throw loudly so tests / runtime catch it immediately
      // rather than silently dropping cards.
      throw new Error(
        `scienceComplete: unknown card color '${(card as { color: string }).color}' for card ${cardID}`,
      );
    }
  }
};
