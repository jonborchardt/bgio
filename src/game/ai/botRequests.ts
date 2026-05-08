// Bot help-request helper.
//
// Each non-chief role's bot, before declaring its turn done, surfaces the
// resource shortfall blocking its preferred action as a `requestHelp`
// move. The chief player then sees the request rendered in their panel's
// "Asks of me" section and can route bank resources accordingly on the
// following chief turn. Without this, a human chief sitting next to three
// bots had no signal at all about what each bot was trying to buy and
// what was missing — they could distribute, but only by guessing.
//
// Dedupe rules:
//   - One open request per (seat, fromRole). The bot is allowed to ask
//     for one thing per turn; subsequent calls within the same turn
//     fall through to the bot's main action (burn / seatDone / etc.).
//     If the bot's row composition changes mid-turn (e.g. it burned
//     the card it was about to ask about), the existing ask still
//     stands so the chief sees a stable signal for the round.
//   - When the chief seat coincides with the requesting seat (happens in
//     1/2/3-player layouts where roles are doubled up), there's no peer
//     to ask, so the helper returns null.

import type { PlayerID, Role, SettlementState } from '../types.ts';
import type { ResourceBag } from '../resources/types.ts';
import type { MoveCandidate } from './enumerate.ts';
import { seatOfRole } from '../roles.ts';
import { computeShortfall, isEmptyBag } from '../requests/blockers.ts';

export interface BotRequestArgs {
  G: SettlementState;
  fromSeat: PlayerID;
  fromRole: Role;
  /** Stable id of the action being attempted — same shape the UI's
   *  RequestHelpButton uses (e.g. `building:Forge`, `tech:Compass`,
   *  `library:T1-blue:Compass`). The chief panel groups outstanding
   *  requests by this id. */
  targetId: string;
  /** Human-readable label of the target (card name etc.). Snapshot so
   *  the chief panel can render without resolving the id. */
  targetLabel: string;
  /** What the action would charge the requester. */
  cost: Partial<ResourceBag>;
}

/**
 * Build a `requestHelp` MoveCandidate when the requester can't yet
 * afford the target action and hasn't already asked. Returns null when
 * there's nothing worth asking for (already affordable / already asked
 * / no chief peer).
 */
export const buildHelpRequestCandidate = ({
  G,
  fromSeat,
  fromRole,
  targetId,
  targetLabel,
  cost,
}: BotRequestArgs): MoveCandidate | null => {
  if (fromRole === 'chief') return null;

  // Chief is the only seat that can mint resources for other seats. If
  // there's no chief seat distinct from the requester, skip.
  let chiefSeat: PlayerID;
  try {
    chiefSeat = seatOfRole(G.roleAssignments, 'chief');
  } catch {
    return null;
  }
  if (chiefSeat === fromSeat) return null;

  const have = G.mats?.[fromSeat]?.stash;
  if (have === undefined) return null;
  const shortfall = computeShortfall(have, cost);
  if (isEmptyBag(shortfall)) return null;

  // Suppress duplicates — one open ask per (seat, fromRole). The
  // narrower (seat, targetId) key would let the bot keep asking for
  // help on different cards as it burned through the row, spamming
  // the chief panel; (seat, fromRole) caps that at one outstanding
  // ask per role per round.
  const requests = G.requests ?? [];
  for (const r of requests) {
    if (r.fromSeat === fromSeat && r.fromRole === fromRole) return null;
  }

  return {
    move: 'requestHelp',
    args: [
      {
        fromRole,
        targetId,
        targetLabel,
        slices: [
          {
            toSeat: chiefSeat,
            need: { kind: 'resources', bag: shortfall },
          },
        ],
      },
    ],
  };
};
