// Move definitions for Settlement.
//
// `pass` is the only legal move at this skeleton stage — it does nothing
// to G and lets the engine advance the turn. Real moves register here as
// later stages land (build, draft, trade, etc.).

import type { Move } from 'boardgame.io';
import type { SettlementState } from './types.ts';

export const pass: Move<SettlementState> = () => {
  // intentional no-op — bgio advances the turn after the move resolves.
};
