// Activity-log types for the EventLogDrawer.
//
// These were formerly under `src/game/activity.ts` as match-state shapes
// pushed by every move. They now live here as a pure UI concern: the
// drawer projects bgio's `client.log` through `formatters.ts` and emits
// `ActivityEntry`s. No game-state dependency, no parallel event log.

import type { PlayerID, Role } from '../../game/types.ts';
import type { Resource } from '../../game/resources/types.ts';

export interface CardPart {
  /** Card id from `src/cards/registry.ts` (e.g. `tech:Wheel`,
   *  `building:Granary`). The renderer resolves it via `cardById`. */
  card: string;
  /** Optional inline label override. Defaults to the registry's
   *  `cardName(entry)` when omitted. */
  label?: string;
}

export interface ResourcePart {
  resource: Resource;
  count: number;
  sign?: '+' | '-';
}

/** A token in an activity entry's inline rendering. Plain strings are
 *  text; the object shapes denote a card reference or a resource token. */
export type ActivityPart = string | CardPart | ResourcePart;

export const isCardPart = (p: ActivityPart): p is CardPart =>
  typeof p === 'object' && p !== null && 'card' in p;
export const isResourcePart = (p: ActivityPart): p is ResourcePart =>
  typeof p === 'object' && p !== null && 'resource' in p;

/** Convenience builder for a card-reference part. */
export const card = (cardId: string, label?: string): CardPart =>
  label === undefined ? { card: cardId } : { card: cardId, label };

/** Convenience builder for a resource-token part. */
export const res = (
  resource: Resource,
  count: number,
  sign?: '+' | '-',
): ResourcePart =>
  sign === undefined ? { resource, count } : { resource, count, sign };

export interface ActivityEntry {
  /** Round number computed from the log's phase transitions; 1-indexed. */
  round: number;
  /** Acting seat. Absent for engine entries. */
  seat?: PlayerID;
  /** Role under which the action was performed. Drives accent color in UI. */
  role?: Role;
  /** Inline tokens; rendered left-to-right with wrapping. */
  parts: ActivityPart[];
}
