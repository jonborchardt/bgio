// foreignPlayTech (08.6) — Foreign seat plays a red-color tech card.
//
// Tech cards distributed by 05.3's `scienceComplete` for a red-color
// science card land in `G.foreign.hand`. That hand is mixed-typed
// today: starter `UnitDef` entries (07.2 Militia seed) live alongside
// `TechnologyDef` entries pushed by 05.3. We filter to tech-shaped
// entries (those with a `branch` field) so a unit-card lookup never
// confuses the move.
//
// All gating + dispatch logic lives in the shared `playTechStub`
// factory; this file just binds the (role, hand-accessor) pair plus
// the type-narrowing filter.

import type { Move } from 'boardgame.io';
import type { SettlementState } from '../../types.ts';
import type { TechnologyDef } from '../../../data/schema.ts';
import { playTechStub } from '../../tech/playTechStub.ts';

export const foreignPlayTech: Move<SettlementState> = playTechStub(
  'foreign',
  (G): TechnologyDef[] | undefined => {
    const hand = G.foreign?.hand;
    if (hand === undefined) return undefined;
    // ForeignState.hand is mixed-typed. Narrow to tech-shaped entries
    // (presence of `branch` is the discriminator). 07.4 will eventually
    // refactor the hand into separate slots; until then this filter
    // is the single source of truth for "what counts as a tech here".
    // TypeScript can't structurally narrow `UnitDef` (which lacks
    // `branch`) to `TechnologyDef`, so we route through `unknown` to
    // strip the source-side type before the predicate.
    return (hand as unknown as unknown[]).filter(
      (e): e is TechnologyDef =>
        typeof (e as { branch?: unknown }).branch === 'string',
    );
  },
);
