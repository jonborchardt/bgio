// scienceComplete (05.3) — the Science role completes a science card whose
// `paid` ledger covers its `cost`. Per game-design.md §Science:
//   - Resources move from the paid ledger into the bank (they are spent).
//   - The 4 face-down tech cards under the science card are distributed by
//     color: red → Foreign, gold → Chief, green → Domestic, blue → Science.
//   - At most one science card may be completed per round (per-round
//     counter, reset by the `science:reset-completions` hook at endOfRound).

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState, PlayerID } from '../../types.ts';
import type { TechnologyDef } from '../../../data/schema.ts';
import { RESOURCES } from '../../resources/types.ts';
import type { ResourceBag } from '../../resources/types.ts';
import { canAfford } from '../../resources/bag.ts';
import { transfer } from '../../resources/bank.ts';
import { appendBankLog } from '../../resources/bankLog.ts';
import { rolesAtSeat, seatOfRole } from '../../roles.ts';
import { applyTechOnAcquire } from '../../tech/effects.ts';
import { fromBgio, type BgioRandomLike } from '../../random.ts';
import { clearUndoable } from '../../undo.ts';
import { clearRequestsForTarget } from '../../requests/clear.ts';
import { idForScience } from '../../../cards/registry.ts';

export const scienceComplete: Move<SettlementState> = (
  { G, ctx, playerID, random },
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

  clearUndoable(G);

  // Mark complete and bump the per-round counter.
  science.completed.push(cardID);
  science.perRoundCompletions += 1;

  // Drop any pending help requests tied to this science card.
  clearRequestsForTarget(G, idForScience(card));

  // Move every non-zero resource in the paid ledger to the bank. We sweep
  // the entire paid bag rather than just `card.cost` — the contribute move
  // caps amounts so paid should never exceed cost, but moving the full
  // ledger keeps us robust against any accidental over-contribution.
  const sweep: Partial<ResourceBag> = {};
  for (const r of RESOURCES) {
    if (paid[r] > 0) sweep[r] = paid[r];
  }
  transfer(paid, G.bank, sweep);
  appendBankLog(G, 'scienceSweep', sweep, `Science card ${cardID}`);
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
  //
  // 08.6 — `applyTechOnAcquire` fires for any tech that ships
  // `onAcquireEffects`. V1 most don't, so this is a no-op for the bulk
  // of distributions. We compute the receiving seat per color (so the
  // dispatcher can credit the right stash for awaiting-input effects)
  // and pass an empty context object — the science seat is mid-stage,
  // and threading bgio's `events` API + `returnTo` through here would
  // require a bigger refactor. The dispatcher gracefully no-ops the
  // stage push when `events` is unset (see 08.2's contract); awaiting-
  // input effects record on `G._awaitingInput` for the seat regardless.
  const techStack: TechnologyDef[] = science.underCards[cardID] ?? [];
  const fallbackRandom: BgioRandomLike = {
    Shuffle: <T>(arr: T[]): T[] => [...arr],
    Number: () => 0,
  };
  const r = fromBgio((random as BgioRandomLike | undefined) ?? fallbackRandom);
  const trySeatOf = (role: 'chief' | 'science' | 'domestic' | 'foreign'): PlayerID | null => {
    try {
      return seatOfRole(G.roleAssignments, role);
    } catch {
      return null;
    }
  };
  switch (card.color) {
    case 'red': {
      // Foreign role. Red techs go into `foreign.techHand` — distinct from
      // `foreign.hand` (units to recruit). 05.3 originally piggy-backed on
      // `hand` while it was typed loosely; the dedicated slot landed when
      // the play-tech UI was wired so the unit and tech lists could render
      // separately under one PlayableHand.
      if (G.foreign === undefined) {
        throw new Error(
          'scienceComplete: G.foreign is undefined; cannot deliver red tech cards',
        );
      }
      if (G.foreign.techHand === undefined) G.foreign.techHand = [];
      const recipient = trySeatOf('foreign');
      for (const tech of techStack) {
        G.foreign.techHand.push(tech);
        if (recipient !== null) applyTechOnAcquire(G, ctx, r, recipient, tech);
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
      const recipient = trySeatOf('chief');
      G.chief.hand!.push(...techStack);
      if (recipient !== null) {
        for (const tech of techStack) applyTechOnAcquire(G, ctx, r, recipient, tech);
      }
      break;
    }
    case 'green': {
      // Domestic role. Older fixtures (pre-06.1) may have no domestic
      // slice at all — initialize a minimal shell with an empty hand of
      // buildings, an empty placed-buildings grid, and an empty techHand
      // ready to receive these green tech cards. The Domestic role's
      // building hand and tech hand are separate slots (see 06.1's
      // `DomesticState`); green tech cards go onto `techHand`.
      if (G.domestic === undefined) {
        G.domestic = { hand: [], grid: {}, techHand: [] };
      } else if (G.domestic.techHand === undefined) {
        G.domestic.techHand = [];
      }
      const recipient = trySeatOf('domestic');
      G.domestic.techHand!.push(...techStack);
      if (recipient !== null) {
        for (const tech of techStack) applyTechOnAcquire(G, ctx, r, recipient, tech);
      }
      break;
    }
    case 'blue': {
      // Science role. ScienceState.hand was added in 05.3.
      science.hand.push(...techStack);
      // Recipient is the science seat (== playerID under the role-gate
      // above, but resolve via the role table to stay symmetric with
      // the other branches).
      const recipient = trySeatOf('science');
      if (recipient !== null) {
        for (const tech of techStack) applyTechOnAcquire(G, ctx, r, recipient, tech);
      }
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
