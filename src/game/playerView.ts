// Per-seat secret-state redaction.
//
// boardgame.io calls `playerView(G, ctx, playerID)` server-side to produce
// the slice of state actually shipped to each connected client. Anything not
// returned here is unrecoverable from the client side — that's the security
// boundary for hidden information (Foreign decks, Domestic hand, etc.).
//
// We resolve which roles the viewing seat holds and redact every slice owned
// by a role they don't hold. Counts stay visible (we replace contents with
// `null` while preserving array length); only order/contents become opaque.
//
// The full hand/deck shapes don't exist yet — 06.1 lands the Foreign decks
// and 07.1 lands the Domestic hand. Today `hands[seat]` is the placeholder
// `{}` from `setup`. The redactor here is intentionally defensive: it walks
// only the array-shaped fields that 06.1/07.1 are slated to introduce
// (`domestic`, `foreign`, `foreignDecks.<name>`) and no-ops on anything
// missing. When 06.1/07.1 plug in real shapes, this file should not need to
// change unless new private array fields are added.

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
// only touched if it's actually an array on the live state. 06.1 and 07.1
// will refine these into the real per-role hand/deck shapes; this stays
// permissive so it doesn't break under the current placeholder `{}`.
interface DomesticSlice {
  domestic?: unknown;
}
interface ForeignSlice {
  foreign?: unknown;
  foreignDecks?: Record<string, unknown>;
}
type HandSlice = DomesticSlice & ForeignSlice & Record<string, unknown>;

const isArray = (x: unknown): x is unknown[] => Array.isArray(x);

/**
 * Returns a fresh hand object for `seat` with the Domestic-owned fields
 * redacted. No-ops on missing fields. Documented expansion point for 07.1.
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
 * Returns a fresh hand object for `seat` with the Foreign-owned fields
 * redacted (the hand itself + every deck under `foreignDecks.<name>`).
 * No-ops on missing fields. Documented expansion point for 06.1.
 */
const redactForeignForSeat = (
  hands: Record<PlayerID, unknown>,
  seat: PlayerID,
): Record<PlayerID, unknown> => {
  const next: Record<PlayerID, unknown> = { ...hands };
  const slice = next[seat];
  if (slice === undefined || slice === null || typeof slice !== 'object') {
    return next;
  }
  const cloned: HandSlice = { ...(slice as HandSlice) };
  if (isArray(cloned.foreign)) {
    cloned.foreign = redactHand(cloned.foreign);
  }
  if (
    cloned.foreignDecks !== undefined &&
    cloned.foreignDecks !== null &&
    typeof cloned.foreignDecks === 'object'
  ) {
    const decks: Record<string, unknown> = { ...cloned.foreignDecks };
    for (const [name, deck] of Object.entries(decks)) {
      if (isArray(deck)) decks[name] = redactDeckOrder(deck);
    }
    cloned.foreignDecks = decks;
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
 *   holds zero roles" and redact every Domestic hand and Foreign hand/deck.
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

  if (!has('foreign')) {
    const forSeat = trySeatOfRole(G.roleAssignments, 'foreign');
    if (forSeat !== null) hands = redactForeignForSeat(hands, forSeat);
  }

  // `chief` and `science` slices are public — face-up tech under each
  // science card and chief actions are visible to everyone. Nothing to
  // redact here today; if 05.x introduces a private science slice this is
  // the place to add it.

  // Only allocate a new top-level object if anything actually changed.
  if (hands === G.hands) return { ...G };
  return { ...G, hands };
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
