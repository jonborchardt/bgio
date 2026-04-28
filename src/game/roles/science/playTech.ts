// sciencePlayTech (08.6) — Science seat plays a blue-color tech card.
//
// Tech cards distributed by 05.3's `scienceComplete` for a blue-color
// science card land in `G.science.hand`. This move lets the Science
// seat play any tech in that hand whose `onPlayEffects` is non-empty.
//
// All gating + dispatch logic lives in the shared `playTechStub`
// factory; this file just binds the (role, hand-accessor) pair.

import type { Move } from 'boardgame.io';
import type { SettlementState } from '../../types.ts';
import type { TechnologyDef } from '../../../data/schema.ts';
import { playTechStub } from '../../tech/playTechStub.ts';

export const sciencePlayTech: Move<SettlementState> = playTechStub(
  'science',
  (G): TechnologyDef[] | undefined => G.science?.hand,
);
