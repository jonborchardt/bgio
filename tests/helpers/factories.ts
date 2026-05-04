// 12.1 — High-level state factories for tests.
//
// These build up a `SettlementState` shaped like the live engine's at various
// well-known checkpoints (fresh game, post-chief-distribute, mid-build,
// mid-science). They sit *above* `seed.ts` (the low-level "raw shape" seed)
// and `makeClient.ts` (the headless bgio client). Reach for a factory when:
//   - you want a state that's structurally consistent with `setup()` but
//     don't want to drive a full bgio client through stages, or
//   - you need a fixture pre-loaded with a building / unit / paid science
//     contribution and the move-driven path would be a long chain.
//
// All factories return a state that satisfies `assertNoNegativeResources`.
// `factories.test.ts` pins this contract.
//
// When the underlying state shape grows (e.g. new role state, new optional
// slot), the factories grow with it — they mirror `setup()`'s output. If
// duplicating field-by-field becomes painful, prefer driving `Settlement.setup`
// through a `Ctx`-shaped fake here over inflating the interface duplication.

import type { Ctx } from 'boardgame.io';
import { Settlement } from '../../src/game/index.ts';
import type {
  PlayerID,
  SettlementState,
} from '../../src/game/types.ts';
import { setup } from '../../src/game/setup.ts';
import type { BgioRandomLike } from '../../src/game/random.ts';
import { bagOf } from '../../src/game/resources/bag.ts';
import { cellKey } from '../../src/game/roles/domestic/grid.ts';
import { BUILDINGS, UNITS } from '../../src/data/index.ts';
import type { ResourceBag } from '../../src/game/resources/types.ts';
import { EMPTY_BAG } from '../../src/game/resources/types.ts';

/** Identity-shuffle random plugin. Same fallback `setup.ts` uses internally,
 *  exposed here so factory call sites can opt for deterministic outcomes
 *  without spinning up a bgio Client. */
const identityRandom: BgioRandomLike = {
  Shuffle: <T>(arr: ReadonlyArray<T>): T[] => [...arr],
  Number: () => 0,
};

const minimalCtx = (numPlayers: 1 | 2 | 3 | 4): Ctx =>
  ({
    numPlayers,
    playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
    playOrderPos: 0,
    currentPlayer: '0',
    turn: 0,
    phase: 'chiefPhase',
    activePlayers: null,
  }) as unknown as Ctx;

/**
 * Build a fresh-from-`setup` SettlementState for `numPlayers` seats.
 *
 * We re-use the real `setup` so any future change to the state shape
 * (new optional slots, new sub-state) flows through to factory output
 * automatically. The bgio random plugin is stubbed to identity so
 * downstream tests can predict the science / deck order.
 */
export const seedFreshGame = (
  numPlayers: 1 | 2 | 3 | 4 = 2,
): SettlementState => {
  const ctx = minimalCtx(numPlayers);
  return setup({ ctx, random: identityRandom });
};

/**
 * Build on `seedFreshGame` and populate the per-seat **stash** bags on
 * each non-chief player mat. `partial` is a `seat -> partial bag` map;
 * missing seats get an empty stash (matching `initialMats` defaults).
 * Unknown seats are silently dropped — chief seats have no mat entry.
 *
 * Use this when a test invokes a non-chief spend move's function form
 * directly (no bgio engine driving stages): spends read from
 * `mat.stash`, so the test wants tokens already swept past the
 * `in→stash` transition that `othersPhase.turn.onBegin` runs at the
 * engine layer. The legacy name "after chief distribute" is preserved
 * to keep call-sites stable; if you need the in-flight `in` slot
 * populated for a chief-stage test, manipulate `G.mats[seat].in`
 * directly.
 */
export const seedAfterChiefDistribute = (
  partial?: Record<PlayerID, Partial<ResourceBag>>,
): SettlementState => {
  const G = seedFreshGame(2);
  if (!partial) return G;
  for (const [seat, amounts] of Object.entries(partial)) {
    const mat = G.mats?.[seat];
    if (mat === undefined) {
      // Chief seat or unknown seat — no mat to populate.
      continue;
    }
    for (const [k, v] of Object.entries(amounts)) {
      if (typeof v === 'number' && v > 0) {
        mat.stash[k as keyof ResourceBag] += v;
      }
    }
  }
  return G;
};

/**
 * Add a placed building to `G.domestic.grid` at `(x, y)`. The building's
 * `defID` is the canonical `BuildingDef.name` (looked up from `BUILDINGS`
 * for shape parity with the runtime placement path). Throws if the def
 * isn't known so a typo doesn't quietly produce ghost data.
 */
export const seedWithBuilding = (
  defID: string,
  x: number,
  y: number,
  base: SettlementState = seedFreshGame(2),
): SettlementState => {
  const def = BUILDINGS.find((b) => b.name === defID);
  if (!def) {
    throw new Error(`seedWithBuilding: unknown BuildingDef.name '${defID}'`);
  }
  if (!base.domestic) {
    throw new Error('seedWithBuilding: base state has no domestic slice');
  }
  base.domestic.grid[cellKey(x, y)] = {
    defID,
    upgrades: 0,
    worker: null,
    hp: def.maxHp,
    maxHp: def.maxHp,
  };
  return base;
};

/**
 * Add a placed unit to `G.defense.inPlay`. The `defID` must match an
 * entry in `UNITS`. For the 1.4 stub shape, each call appends one
 * UnitInstance per requested copy — there is no count-collapsed entry
 * any more (Phase 2 needs per-instance state for HP / drill / taught
 * skills). `cellKey` defaults to the synthetic center tile so callers
 * that just want a body in play don't have to seed a building first.
 */
export const seedWithUnit = (
  defID: string,
  count = 1,
  base: SettlementState = seedFreshGame(2),
): SettlementState => {
  const def = UNITS.find((u) => u.name === defID);
  if (!def) {
    throw new Error(`seedWithUnit: unknown UnitDef.name '${defID}'`);
  }
  if (!base.defense) {
    throw new Error('seedWithUnit: base state has no defense slice');
  }
  const start = base.defense.inPlay.length;
  for (let i = 0; i < count; i += 1) {
    base.defense.inPlay.push({
      id: `unit:${defID}:${start + i}`,
      defID,
      cellKey: '0,0',
      hp: def.hp,
      placementOrder: start + i,
    });
  }
  return base;
};

/**
 * Mark `G.science.paid[cardID]` as having received `paid` resources.
 * Use this to skip a long chain of `scienceContribute` moves when the
 * test wants the under-test path to start at "card 80% paid".
 */
export const seedMidScienceProgress = (
  cardID: string,
  paid: Partial<ResourceBag>,
  base: SettlementState = seedFreshGame(2),
): SettlementState => {
  if (!base.science) {
    throw new Error('seedMidScienceProgress: base state has no science slice');
  }
  // Lazy-init the per-card paid bag — the real `setupScience` already
  // seeds entries for every card in the grid, but a hand-built base may
  // not. Use `bagOf({})` so the bag is mutable (not the frozen
  // `EMPTY_BAG`).
  const current = base.science.paid[cardID] ?? bagOf({});
  for (const [r, v] of Object.entries(paid)) {
    if (typeof v === 'number') {
      current[r as keyof ResourceBag] =
        (current[r as keyof ResourceBag] ?? 0) + v;
    }
  }
  base.science.paid[cardID] = current;
  return base;
};

// `EMPTY_BAG` is intentionally not re-exported — call sites that need a
// blank bag should import it from `src/game/resources/types.ts` directly.
// We only reference it here to keep the import non-dead in case future
// factories want to seed mats from a constant.
void EMPTY_BAG;

// `Settlement` is intentionally not re-exported — `setup` is enough.
// This `void` keeps it referenced only when a future factory needs the
// full game config.
void Settlement;
