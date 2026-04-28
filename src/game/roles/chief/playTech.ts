// chiefPlayTech (08.6) — Chief plays a gold-color tech card.
//
// Tech cards distributed by 05.3's `scienceComplete` for a gold-color
// science card land in `G.chief.hand`. This move lets the Chief play
// any tech in that hand whose `onPlayEffects` is non-empty.
//
// All gating + dispatch logic lives in the shared `playTechStub`
// factory; this file just binds the (role, hand-accessor) pair.

import type { Move } from 'boardgame.io';
import type { SettlementState } from '../../types.ts';
import type { TechnologyDef } from '../../../data/schema.ts';
import { playTechStub } from '../../tech/playTechStub.ts';

export const chiefPlayTech: Move<SettlementState> = playTechStub(
  'chief',
  (G): TechnologyDef[] | undefined => G.chief?.hand,
);
