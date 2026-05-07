// Help-request types — pure data, no boardgame.io imports.
//
// A help request is "I want to do X but need Y from another player." The
// requester clicks the helper button next to a disabled action; the engine
// produces one HelpRequest per recipient, each carrying only the slice of
// the need that recipient is responsible for. Requests live on
// `G.requests` and are redacted via `playerView` so each viewer sees only
// the rows whose `fromSeat` or `toSeat` is them.

import type { PlayerID, Role } from '../types.ts';
import type { ResourceBag } from '../resources/types.ts';

/**
 * Stable identifier for the action being attempted. Format mirrors the
 * canonical card id from `src/cards/registry.ts` so completion sites can
 * just call `clearRequestsForTarget(G, idForX(def))`. Non-card actions
 * use a synthetic prefix (e.g. `trade:current`).
 */
export type RequestTargetId = string;

/** Need shape — what the recipient is being asked for. Discriminated by
 * `kind` so the UI can render an icon row for resources and plain text
 * for the named-thing variants. */
export type RequestNeed =
  | { kind: 'resources'; bag: Partial<ResourceBag> }
  | { kind: 'building'; name: string }
  | { kind: 'tech'; name: string }
  | { kind: 'unit'; name: string };

export interface HelpRequest {
  /** Composite of `${fromSeat}|${toSeat}|${targetId}` — uniqueness key the
   * toggle move uses to find an existing row to rescind. */
  id: string;
  fromSeat: PlayerID;
  /** The role label of the requester at the time of asking. Recorded so
   * the recipient's box can show "Science: …" without re-deriving from
   * the seat. When the requester holds multiple roles (1/2/3-player
   * layouts), the role most relevant to `targetId` is recorded. */
  fromRole: Role;
  toSeat: PlayerID;
  /** Stable id of the action being attempted (e.g. `building:Forge`). */
  targetId: RequestTargetId;
  /** Human-readable label of the target ("Forge", "Compass", "Scout").
   * Snapshotted so the box can render without resolving the id. */
  targetLabel: string;
  /** What this recipient is being asked for. */
  need: RequestNeed;
  /** Round at which the request was sent — for ordering and audit. */
  round: number;
}
