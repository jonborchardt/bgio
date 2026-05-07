// Per-seat graveyard helper.
//
// Every move that *consumes* a card (plays a tech, buys a building, recruits
// a unit) calls `pushGraveyard` so the table-visible "what has this seat
// played, in what order" list stays accurate. The graveyard is public
// state — both replay tooling and other players can see the log — so we
// don't redact it in `playerView`.
//
// State shape lives on `SettlementState.graveyards`; the entry shape on
// `GraveyardEntry`. Both come from `./types.ts`. We lazy-init the per-seat
// array so older fixtures that pre-date this slot stay source-compatible.

import type { GraveyardEntry, PlayerID, SettlementState } from './types.ts';

export const pushGraveyard = (
  G: SettlementState,
  seat: PlayerID,
  entry: Omit<GraveyardEntry, 'round'>,
): void => {
  if (G.graveyards === undefined) G.graveyards = {};
  if (G.graveyards[seat] === undefined) G.graveyards[seat] = [];
  G.graveyards[seat].push({ ...entry, round: G.round });
};
