// sciencePlayBlueEvent (05.4) — promoted to a real move in 08.3.
//
// Mirrors 04.4 chiefPlayGoldEvent for the Science seat / blue color. All
// the gating, per-cycle / per-round bookkeeping, and 08.2-dispatcher
// effect resolution live in the shared `playEventStub` factory in
// src/game/events/playEventStub.ts; this file just binds
// (role, color, flagKey).

import type { Move } from 'boardgame.io';
import type { SettlementState } from '../../types.ts';
import { playEventStub } from '../../events/playEventStub.ts';

export const sciencePlayBlueEvent: Move<SettlementState> = playEventStub(
  'science',
  'blue',
  'science',
);
