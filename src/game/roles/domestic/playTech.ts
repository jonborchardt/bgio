// domesticPlayTech (08.6) — Domestic seat plays a green-color tech card.
//
// Tech cards distributed by 05.3's `scienceComplete` for a green-color
// science card land in `G.domestic.techHand` (kept distinct from
// `G.domestic.hand`, which is the building-card pile per 06.1). This
// move lets the Domestic seat play any tech in that hand whose
// `onPlayEffects` is non-empty.
//
// All gating + dispatch logic lives in the shared `playTechStub`
// factory; this file just binds the (role, hand-accessor) pair.

import type { Move } from 'boardgame.io';
import type { SettlementState } from '../../types.ts';
import type { TechnologyDef } from '../../../data/schema.ts';
import { playTechStub } from '../../tech/playTechStub.ts';

export const domesticPlayTech: Move<SettlementState> = playTechStub(
  'domestic',
  (G): TechnologyDef[] | undefined => G.domestic?.techHand,
);
