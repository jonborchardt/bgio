// Cross-cutting events (08.x) — deck shape, per-seat cycle bookkeeping, and
// the round-end hook that resets `playedThisRound`.
//
// State invariants (per the 08.1 plan):
// - `decks[color]` is the master pool for that color. It is *never depleted*
//   — drawing into a hand keeps the card object referenced from the deck,
//   and `cycleAdvance` resets `used[color][seat]` once the seat has cycled
//   through every card. The pool reopens, the same card defs are drawable
//   again.
// - `hands[color][seat]` is the visible options for the holding seat. Today
//   that's the entire color deck (4 cards) for the seat that holds the
//   role. 08.2+ may carve this down per round.
// - `used[color][seat]` is the array of card ids the seat has already played
//   in the current cycle. When it reaches the size of `decks[color]`, the
//   cycle is complete and we clear it so the same cards become legal again.
// - `playedThisRound[seat]` lists the colors a seat has already played this
//   round. The "may play 1 X event card if they have one at any time" rule
//   from game-design.md (one per color per round) gates on this list.
//
// Role → color mapping (per game-design.md §Player phases):
//   chief    → gold
//   science  → blue
//   domestic → green
//   foreign  → red
//
// The round-end hook `events:reset-played-this-round` clears
// `playedThisRound` so each seat is free to play one card of each color
// again next round.

import { EVENT_CARDS, type EventCardDef, type EventColor } from '../../data/events.ts';
import type { PlayerID, Role } from '../types.ts';
import type { RandomAPI } from '../random.ts';
import { registerRoundEndHook } from '../hooks.ts';

export type { EventColor, EventCardDef };

export interface EventsState {
  // Master pool per color. Never depleted — see module-level invariants.
  decks: Record<EventColor, EventCardDef[]>;
  // Visible options for the holding seat: hands[color][seat].
  hands: Record<EventColor, Record<PlayerID, EventCardDef[]>>;
  // Ids of cards the seat has played in the current cycle.
  used: Record<EventColor, Record<PlayerID, string[]>>;
  // Colors each seat has already played this round.
  playedThisRound: Record<PlayerID, EventColor[]>;
}

// Role → event-color mapping. The role that holds the role plays that color.
// Hard-coded here rather than parametrized via JSON because it's a design
// decision, not content data.
const ROLE_TO_COLOR: Record<Role, EventColor> = {
  chief: 'gold',
  science: 'blue',
  domestic: 'green',
  foreign: 'red',
};

const ALL_COLORS: readonly EventColor[] = ['gold', 'blue', 'green', 'red'] as const;

// How many cards we deal from each deck into the holding seat's hand at
// setup. Per game-design.md §Events: "Each get 4 events".
const HAND_SIZE = 4;

/**
 * Find the seat that holds the role mapping to `color`.
 *
 * Returns `null` rather than throwing when no seat is found. In smaller
 * player counts the same seat may hold multiple roles, but every supported
 * count (1..4) has every role assigned to *some* seat — so a `null` from
 * here would indicate a misconfigured assignments table, not a normal game
 * state. Callers that *must* find a seat should treat `null` as fatal.
 */
const seatHoldingColor = (
  assignments: Record<PlayerID, Role[]>,
  color: EventColor,
): PlayerID | null => {
  const targetRole = (Object.entries(ROLE_TO_COLOR) as [Role, EventColor][])
    .find(([, c]) => c === color)?.[0];
  if (targetRole === undefined) return null;
  for (const [seat, roles] of Object.entries(assignments)) {
    if (roles.includes(targetRole)) return seat;
  }
  return null;
};

/**
 * Build the initial events state.
 *
 * For each color we:
 * 1. Collect all cards of that color into the master deck pool.
 * 2. Find the seat that holds the matching role.
 * 3. Deal HAND_SIZE cards into hands[color][seat] (preserving references —
 *    cards remain in the deck pool too; the deck is the cycle reset pool,
 *    not a draw pile that gets depleted).
 * 4. Initialize used[color][seat] to an empty array.
 *
 * `playedThisRound` is initialized to an empty array per seat present in
 * `assignments`.
 */
export const setupEvents = (
  assignments: Record<PlayerID, Role[]>,
  random: RandomAPI,
): EventsState => {
  const decks: Record<EventColor, EventCardDef[]> = {
    gold: [],
    blue: [],
    green: [],
    red: [],
  };
  const hands: Record<EventColor, Record<PlayerID, EventCardDef[]>> = {
    gold: {},
    blue: {},
    green: {},
    red: {},
  };
  const used: Record<EventColor, Record<PlayerID, string[]>> = {
    gold: {},
    blue: {},
    green: {},
    red: {},
  };

  for (const color of ALL_COLORS) {
    // Pool of all cards for this color. Spread to take a fresh mutable array
    // (the EVENT_CARDS source is frozen).
    const pool = EVENT_CARDS.filter((c) => c.color === color).map((c) => c);
    decks[color] = pool;

    const seat = seatHoldingColor(assignments, color);
    if (seat === null) continue;

    // Deal HAND_SIZE cards by shuffling the pool and slicing. Card references
    // are shared with the deck pool — the deck is *not* a draw pile that
    // gets depleted; it's the master cycle-reset pool.
    const dealt = random.shuffle(pool).slice(0, HAND_SIZE);
    hands[color][seat] = dealt;
    used[color][seat] = [];
  }

  const playedThisRound: Record<PlayerID, EventColor[]> = {};
  for (const seat of Object.keys(assignments)) {
    playedThisRound[seat] = [];
  }

  return { decks, hands, used, playedThisRound };
};

/**
 * Mark `cardId` (which the seat just played) as used in the current cycle
 * for `(color, seat)`, then check whether the cycle is complete. If it is —
 * i.e. the used list has grown to the size of the master deck for that
 * color — clear it so the pool reopens.
 *
 * Plan-signature deviation: the 08.1 plan's API line lists
 * `cycleAdvance(state, color, seat)` with no card id, but its body says
 * "Push the just-played card id into used[color][seat]." Those two are
 * inconsistent, and the tests in the same plan say "Drive via cycleAdvance
 * × 4 then assert used is empty" — which only works if each call advances
 * the used list by one. We resolve the ambiguity in favor of the body /
 * test description: `cycleAdvance` takes a fourth `cardId` argument,
 * pushes it, and resets the cycle when it fills.
 *
 * Plan also says "If used.length === 4". We size-compare against
 * `decks[color].length` instead of hard-coding 4 so that 08.2+ content
 * additions (e.g. tech cards adding events to the pool) cycle correctly
 * without a touch-up here. The starter content has 4 cards per color so
 * the two checks coincide today.
 */
export const cycleAdvance = (
  state: EventsState,
  color: EventColor,
  seat: PlayerID,
  cardId: string,
): void => {
  const usedForSeat = state.used[color][seat];
  if (usedForSeat === undefined) {
    throw new Error(
      `cycleAdvance: no used-list for color=${color} seat=${seat}`,
    );
  }
  usedForSeat.push(cardId);
  const deckSize = state.decks[color].length;
  if (usedForSeat.length >= deckSize) {
    // Cycle complete — clear the list so the pool of `deckSize` cards
    // reopens for this seat.
    state.used[color][seat] = [];
  }
};

// Round-end hook: clear `playedThisRound` so each seat is free to play one
// card of each color again next round. Registered at module load
// (idempotent — see 02.5 hooks registry contract). Tests that need a clean
// slate must call `__resetHooksForTest()` and then re-import this module.
registerRoundEndHook('events:reset-played-this-round', (G) => {
  if (G.events === undefined) return;
  for (const seat of Object.keys(G.events.playedThisRound)) {
    G.events.playedThisRound[seat] = [];
  }
});

// Round-end hook: clear `_eventPlayedThisRound`, the per-role single-flag
// ledger that 04.4 / 05.4 / 06.6 / 07.6's stub moves consult to enforce
// "may play one event per round per role". Without this reset, after
// round 1 every role is permanently locked out of playing events.
registerRoundEndHook('events:reset-event-played-this-round', (G) => {
  if (G._eventPlayedThisRound !== undefined) {
    G._eventPlayedThisRound = {};
  }
});
