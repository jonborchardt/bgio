// Per-seat secret-state redaction.
//
// boardgame.io calls `playerView(G, ctx, playerID)` server-side to produce
// the slice of state actually shipped to each connected client. Anything not
// returned here is unrecoverable from the client side — that's the security
// boundary for hidden information (Defense decks, Domestic hand, etc.).
//
// We resolve which roles the viewing seat holds and redact every slice owned
// by a role they don't hold. Counts stay visible (we replace contents with
// `null` while preserving array length); only order/contents become opaque.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, Role, SettlementState } from './types.ts';
import { rolesAtSeat, seatOfRole } from './roles.ts';

/**
 * Replaces every entry in the given deck/hand array with `null` while
 * preserving the array's length. This matches bgio's "counts visible,
 * contents secret" convention.
 */
export const redactDeckOrder = <T>(deck: T[]): T[] =>
  Array(deck.length).fill(null) as unknown as T[];

/**
 * Same shape as `redactDeckOrder` — separate name for call-site clarity
 * (a hand is a multiset of cards held by a player, vs. an ordered deck).
 */
export const redactHand = <T>(hand: T[]): T[] =>
  Array(hand.length).fill(null) as unknown as T[];

// --- internal helpers ------------------------------------------------------

// Shape we know how to redact today. Defensive — every field optional and
// only touched if it's actually an array on the live state.
interface DomesticSlice {
  domestic?: unknown;
}
interface DefenseHandSlice {
  defense?: unknown;
}
type HandSlice = DomesticSlice & DefenseHandSlice & Record<string, unknown>;

const isArray = (x: unknown): x is unknown[] => Array.isArray(x);

/**
 * Returns a fresh hand object for `seat` with the Domestic-owned fields
 * redacted. No-ops on missing fields.
 */
const redactDomesticForSeat = (
  hands: Record<PlayerID, unknown>,
  seat: PlayerID,
): Record<PlayerID, unknown> => {
  const next: Record<PlayerID, unknown> = { ...hands };
  const slice = next[seat];
  if (slice === undefined || slice === null || typeof slice !== 'object') {
    return next;
  }
  const cloned: HandSlice = { ...(slice as HandSlice) };
  if (isArray(cloned.domestic)) {
    cloned.domestic = redactHand(cloned.domestic);
  }
  next[seat] = cloned;
  return next;
};

/**
 * Returns a fresh hand object for `seat` with the Defense-owned fields
 * redacted. No-ops on missing fields.
 */
const redactDefenseForSeat = (
  hands: Record<PlayerID, unknown>,
  seat: PlayerID,
): Record<PlayerID, unknown> => {
  const next: Record<PlayerID, unknown> = { ...hands };
  const slice = next[seat];
  if (slice === undefined || slice === null || typeof slice !== 'object') {
    return next;
  }
  const cloned: HandSlice = { ...(slice as HandSlice) };
  if (isArray(cloned.defense)) {
    cloned.defense = redactHand(cloned.defense);
  }
  next[seat] = cloned;
  return next;
};

/**
 * Best-effort lookup of the unique seat holding `role`. Returns `null` if
 * the role isn't assigned (e.g., a partial test fixture) rather than
 * throwing — playerView shouldn't crash a render on a malformed assignment.
 */
const trySeatOfRole = (
  assignments: Record<PlayerID, Role[]>,
  role: Role,
): PlayerID | null => {
  try {
    return seatOfRole(assignments, role);
  } catch {
    return null;
  }
};

// --- main entry ------------------------------------------------------------

/**
 * Internal redactor: returns the slice of `G` visible to `playerID`.
 *
 * - `playerID === null`/`undefined` → spectator. We treat this as "viewer
 *   holds zero roles" and redact every Domestic / Defense hand.
 * - Otherwise we resolve the viewer's roles via `rolesAtSeat` and redact
 *   the slices owned by every role NOT in that set.
 *
 * The returned object is a fresh shallow clone of `G` with the redacted
 * sub-slices replaced surgically. We never mutate the input.
 *
 * bgio's actual `Game.playerView` hook takes a context object; this
 * function exposes the simpler positional form so unit tests can drive it
 * directly without faking the Ctx/game/data fields. The exported
 * `playerView` below adapts it to bgio's call shape.
 */
export const playerViewFor = (
  G: SettlementState,
  _ctx: Ctx,
  playerID: PlayerID | null | undefined,
): SettlementState => {
  // bgio's debug panel and pre-init paths can call playerView before `setup`
  // has populated `roleAssignments`/`hands`. Bail out cleanly in that case
  // rather than crashing the whole client — there's nothing to redact yet.
  if (G === null || G === undefined || G.roleAssignments === undefined) {
    return G;
  }
  // The runtime occasionally passes `undefined` (rather than `null`) for an
  // unauthenticated/spectator viewer; coalesce so the role lookup matches.
  const viewerRoles: Role[] =
    playerID === null || playerID === undefined
      ? []
      : rolesAtSeat(G.roleAssignments, playerID);
  const has = (role: Role) => viewerRoles.includes(role);

  let hands = G.hands;

  if (!has('domestic')) {
    const domSeat = trySeatOfRole(G.roleAssignments, 'domestic');
    if (domSeat !== null) hands = redactDomesticForSeat(hands, domSeat);
  }

  if (!has('defense')) {
    const defSeat = trySeatOfRole(G.roleAssignments, 'defense');
    if (defSeat !== null) hands = redactDefenseForSeat(hands, defSeat);
  }

  // 1.4 — the real Defense state lives on G.defense. Its hand and
  // techHand are private to whoever holds Defense. Only deck/hand
  // *length* leaks (we replace contents with null and keep the array
  // shape).
  let defense = G.defense;
  if (!has('defense') && defense !== undefined) {
    defense = {
      ...defense,
      hand: redactHand(defense.hand),
      ...(defense.techHand !== undefined
        ? { techHand: redactHand(defense.techHand) }
        : {}),
    };
  }

  // 05.3 distributes tech cards into per-role private hands. Chief gets
  // gold-color techs, Domestic gets green-color techs (techHand),
  // Science gets blue-color techs (science.hand). Each is private to
  // its holding seat.
  let chief = G.chief;
  if (!has('chief') && chief !== undefined && chief.hand !== undefined) {
    chief = { ...chief, hand: redactHand(chief.hand) };
  }
  let domestic = G.domestic;
  if (!has('domestic') && domestic !== undefined) {
    const next = { ...domestic };
    if (next.hand !== undefined) next.hand = redactHand(next.hand);
    if (next.techHand !== undefined) next.techHand = redactHand(next.techHand);
    domestic = next;
  }
  let science = G.science;
  if (!has('science') && science !== undefined && science.hand !== undefined) {
    science = { ...science, hand: redactHand(science.hand) };
  }

  // 08.1 — every role's event-card hand. Each color belongs to exactly
  // one role (chief=gold, science=blue, domestic=green, defense=red);
  // a viewer sees only the hand for the colors of roles they hold.
  // `used` and `playedThisRound` stay visible (those are public
  // bookkeeping the cycle UI needs).
  let events = G.events;
  if (events !== undefined) {
    const colorByRole: Record<Role, 'gold' | 'blue' | 'green' | 'red'> = {
      chief: 'gold',
      science: 'blue',
      domestic: 'green',
      defense: 'red',
    };
    const nextHands = { ...events.hands };
    for (const role of ['chief', 'science', 'domestic', 'defense'] as Role[]) {
      if (has(role)) continue;
      const color = colorByRole[role];
      const seat = trySeatOfRole(G.roleAssignments, role);
      if (seat === null) continue;
      const perColor = nextHands[color];
      if (!perColor) continue;
      const arr = perColor[seat];
      if (!Array.isArray(arr)) continue;
      nextHands[color] = { ...perColor, [seat]: redactHand(arr) };
    }
    events = { ...events, hands: nextHands };
  }

  // 08.2 awaiting-input parks an effect a seat is resolving (e.g. a
  // swapTwoScienceCards prompt). The effect itself describes what
  // they're picking from, which can be sensitive — only the seat
  // actually resolving needs it. We drop other seats' entries entirely
  // (rather than null-ing them) since the type is
  // `Record<PlayerID, EventEffect>` and null isn't assignable.
  let awaitingInput = G._awaitingInput;
  if (awaitingInput !== undefined) {
    const viewerSeat =
      playerID === null || playerID === undefined ? null : playerID;
    const filtered: typeof awaitingInput = {};
    for (const [seat, parked] of Object.entries(awaitingInput)) {
      if (viewerSeat !== null && seat === viewerSeat) {
        filtered[seat] = parked;
      }
      // Other seats: omitted. Presence/absence still leaks (callers
      // can tell *whether* a peer is mid-prompt) but the effect
      // payload doesn't.
    }
    awaitingInput = filtered;
  }

  // Defense redesign 2.2 — `G.track` (the Global Event Track) is fully
  // public table information: every viewer sees the same `upcoming`,
  // `history`, and `currentPhase`. The face-up next card is the design's
  // table-presence telegraph (D19), so we deliberately do *not* redact
  // it here. No code below this comment touches `G.track`.

  // 08.4 — opponent wander deck. The deck order is hidden from EVERY
  // viewer (including the chief seat) — there's no role that "owns" the
  // opponent's hand. `currentlyApplied` and `discard` stay visible so
  // observers can see what just hit the village.
  let opponent = G.opponent;
  if (opponent !== undefined) {
    opponent = {
      ...opponent,
      wander: {
        ...opponent.wander,
        deck: redactDeckOrder(opponent.wander.deck),
      },
    };
  }

  // Help requests: each row is visible only to the requester and the
  // recipient. Spectators see none. The list is small (a handful of
  // active rows at most), so a simple filter is fine.
  let requests = G.requests;
  if (requests !== undefined) {
    const viewerSeat =
      playerID === null || playerID === undefined ? null : playerID;
    if (viewerSeat === null) {
      requests = [];
    } else {
      requests = requests.filter(
        (r) => r.fromSeat === viewerSeat || r.toSeat === viewerSeat,
      );
    }
  }

  // Only allocate a new top-level object if anything actually changed.
  if (
    hands === G.hands &&
    defense === G.defense &&
    chief === G.chief &&
    domestic === G.domestic &&
    science === G.science &&
    events === G.events &&
    awaitingInput === G._awaitingInput &&
    opponent === G.opponent &&
    requests === G.requests
  ) {
    return { ...G };
  }
  return {
    ...G,
    hands,
    defense,
    chief,
    domestic,
    science,
    events,
    _awaitingInput: awaitingInput,
    opponent,
    requests,
  };
};

/**
 * bgio's `Game.playerView` hook. bgio 0.50 calls this with a single
 * context object (`{G, ctx, playerID}`), not three positional args. We
 * adapt to `playerViewFor` so the unit-test surface stays positional and
 * easy to call without faking the rest of bgio's context fields.
 */
export const playerView = ({
  G,
  ctx,
  playerID,
}: {
  G: SettlementState;
  ctx: Ctx;
  playerID?: PlayerID | null;
}): SettlementState => playerViewFor(G, ctx, playerID ?? null);
