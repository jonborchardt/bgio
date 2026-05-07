// Science Library SL 3.1 — `scienceLibraryBuy(slotIndex)` move.
//
// Fires during the science seat's `scienceTurn` stage. Pays the
// (effective, post-discount) research cost from the seat's stash (or
// from `G.bank` when the science seat is also the chief seat in 1p/2p/3p
// layouts), pushes the bought card into the recipient role's hand,
// appends a copy to the seat's discount tableau, and nulls the row slot.
// Refill is end-of-turn (SL 3.3).

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import type { LibraryCard } from '../../library/types.ts';
import { rolesAtSeat } from '../../roles.ts';
import {
  canAffordFromStashOrBank,
  payFromStashOrBank,
} from '../../resources/moves.ts';
import { effectiveResearchCost } from '../../library/costs.ts';
import { seatHoldingColor } from '../../events/state.ts';
import { clearUndoable } from '../../undo.ts';

// Push the bought card into the right table-presence pile, routing by
// `card.kind` first and `card.scienceColor` second:
//
//   kind === 'event'    → G.events.hands[card.scienceColor][holderSeat]
//   kind === 'building' → G.<recipient>.hand          (BuildingDef[])
//   kind === 'unit'     → G.defense.hand              (UnitDef[])
//   kind === 'tech'     → G.<recipient>.hand|techHand (TechnologyDef[])
//
// Recipient color → role: gold→chief, blue→science, green→domestic,
// red→defense. Recipient slices may be absent on hand-built fixtures;
// we lazy-init the slot rather than throwing so the move stays robust.
const handoffToRecipient = (
  G: SettlementState,
  card: LibraryCard,
): void => {
  if (card.kind === 'event') {
    if (G.events === undefined) return;
    const seat = seatHoldingColor(G.roleAssignments, card.scienceColor);
    if (seat === null) return;
    const colorHands = G.events.hands[card.scienceColor];
    if (colorHands[seat] === undefined) colorHands[seat] = [];
    colorHands[seat]!.push(card.def);
    return;
  }

  switch (card.scienceColor) {
    case 'gold': {
      // Gold non-event cards are tech (chief T3 → science). Buildings /
      // units never carry the gold color (chief has no buildings or
      // units), but the routing stays kind-driven so a future content
      // tag can't silently mis-route.
      if (G.chief === undefined) {
        G.chief = { workers: 0, hand: [] };
      } else if (G.chief.hand === undefined) {
        G.chief.hand = [];
      }
      if (card.kind === 'tech') {
        G.chief.hand!.push(card.def);
      }
      return;
    }
    case 'blue': {
      if (G.science === undefined) return;
      if (G.science.hand === undefined) G.science.hand = [];
      if (card.kind === 'tech') {
        G.science.hand.push(card.def);
      }
      return;
    }
    case 'green': {
      if (G.domestic === undefined) {
        G.domestic = { hand: [], grid: {}, techHand: [] };
      }
      if (card.kind === 'building') {
        G.domestic.hand.push(card.def);
      } else if (card.kind === 'tech') {
        if (G.domestic.techHand === undefined) G.domestic.techHand = [];
        G.domestic.techHand.push(card.def);
      }
      return;
    }
    case 'red': {
      if (G.defense === undefined) {
        G.defense = { hand: [], inPlay: [] };
      }
      if (card.kind === 'unit') {
        G.defense.hand.push(card.def);
      } else if (card.kind === 'tech') {
        if (G.defense.techHand === undefined) G.defense.techHand = [];
        G.defense.techHand.push(card.def);
      }
      return;
    }
  }
};

export const scienceLibraryBuy: Move<SettlementState> = (
  { G, ctx, playerID },
  slotIndex: number,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return INVALID_MOVE;

  const lib = G.library;
  if (lib === undefined) return INVALID_MOVE;

  if (
    typeof slotIndex !== 'number' ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= lib.row.length
  ) {
    return INVALID_MOVE;
  }
  const card = lib.row[slotIndex];
  if (card === null || card === undefined) return INVALID_MOVE;

  const tableau = lib.discountTableaus[playerID] ?? [];
  const cost = effectiveResearchCost(card, tableau);

  // Affordability + payment fall through to `G.bank` when the science
  // seat is also the chief seat (1p / 2p / 3p assignments). In 4p the
  // seat has its own mat and the helpers behave like `payFromStash` /
  // `canAfford(mat.stash, ...)`.
  if (!canAffordFromStashOrBank(G, playerID, cost)) return INVALID_MOVE;

  clearUndoable(G);
  payFromStashOrBank(G, playerID, cost);
  handoffToRecipient(G, card);
  if (lib.discountTableaus[playerID] === undefined) {
    lib.discountTableaus[playerID] = [];
  }
  lib.discountTableaus[playerID]!.push(card);
  // Null the slot — refill happens at end-of-turn (SL 3.3).
  lib.row[slotIndex] = null;
};
