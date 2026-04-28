// domesticPlayGreenEvent (06.6) — STUB.
//
// Mirrors 04.4 chiefPlayGoldEvent for the Domestic seat / green color.
// All the gating + per-cycle / per-round bookkeeping logic lives in the
// shared `playEventStub` factory in src/game/events/playEventStub.ts;
// this file just binds (role, color, flagKey).
//
// TODO(08.3): once the typed effect dispatcher and concrete green card
// surfaces exist, this move should also resolve the card's effects
// (calling into 08.2's dispatcher, and possibly entering the
// `playingEvent` stage via `enterEventStage` if the effects need user
// follow-up). Until then we just mark the play.

import type { Move } from 'boardgame.io';
import type { SettlementState } from '../../types.ts';
import { playEventStub } from '../../events/playEventStub.ts';

export const domesticPlayGreenEvent: Move<SettlementState> = playEventStub(
  'domestic',
  'green',
  'domestic',
);
