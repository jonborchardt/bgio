// foreignPlayTech (08.6) — Foreign seat plays a red-color tech card.
//
// Red techs distributed by 05.3's `scienceComplete` land in
// `G.foreign.techHand` (separate from `foreign.hand`, which holds units
// to recruit).
//
// All gating + dispatch logic lives in the shared `playTechStub` factory.

import type { Move } from 'boardgame.io';
import type { SettlementState } from '../../types.ts';
import { playTechStub } from '../../tech/playTechStub.ts';

export const foreignPlayTech: Move<SettlementState> = playTechStub(
  'foreign',
  (G) => G.foreign?.techHand,
);
