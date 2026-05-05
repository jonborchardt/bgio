// Defense redesign 2.3 — track-card resolve pipeline.
//
// Single entry point `resolveTrackCard(G, random, card)` is called by
// `chiefFlipTrack` after `advanceTrack(G.track)` returns the just-popped
// card. The resolver dispatches on `card.kind`:
//
//   - boon     → applies the printed effect through the same dispatcher
//                the per-color event-card moves use.
//   - modifier → pushes the card's effect onto `G._modifiers` (the same
//                queue the event-card dispatcher uses) so any role move
//                that gates on `hasModifierActive(G, kind)` /
//                `consumeModifier(G, kind)` from
//                `events/dispatcher.ts` can read it uniformly,
//                regardless of whether the modifier came from a track
//                flip or an event card. (V1 ships these helpers but
//                does not yet wire role moves to consult them; the
//                queue plumbing is correct so consumers can be added
//                without further engine work.) The card itself is
//                also recorded on `G.track.activeModifiers` so the
//                end-of-round hook can expire any unconsumed entries
//                (spec §2 D20: "modifiers bend rules for one round").
//   - threat   → walks the path / fire / impact pipeline (spec §3 + §4).
//   - boss     → no-op stub. Phase 2.7 lands the real boss resolver.
//
// The resolver is deliberately kept pure-ish — it mutates `G` in place
// (Immer-friendly) but takes no bgio plumbing beyond the `RandomAPI`
// stub. The combat math lives here so unit tests can exercise it
// against a synthetic `G` without booting a full client.
//
// Combat math (spec §4):
//
//   1. Compute the path from the threat's entry point to center.
//   2. The first impact tile is the first occupied cell on the path
//      (excluding center).
//   3. Every unit whose Chebyshev range covers any cell on the path
//      between the threat's entry and the first impact tile gets one
//      fire opportunity.
//   4. Order firing units: first-strike before non-first-strike, then
//      placement order within each tier.
//   5. Each unit's effective stats fold (in this order):
//        - the unit def's printed `attack` / `range`,
//        - `placementBonus` matched to the building underneath the
//          unit,
//        - `taughtSkills` (D27 — Phase 2.6's `scienceTeach` move grants
//          them; the resolver applies them here at fire time),
//        - the global "vs <keyword> +N" bonus when the threat's
//          `modifiers[]` contains a tag the unit's effect line
//          references,
//        - finally a one-shot `drillToken` (+1 strength on next fire).
//      Drill is *always* additive after every other modifier (D27) so
//      it can't be masked by a placement bonus, a skill, or a matchup
//      keyword — the +1 lands last, on top of whatever the other layers
//      produced.
//      The V1 unit JSON does not yet carry per-keyword bonuses on
//      `placementBonus[]` (those are a future content add); the
//      resolver still iterates the matchup-tag check so the structure
//      is in place for content.
//   6. For each fire, deduct the unit's effective strength from the
//      threat's HP. If HP <= 0, the threat dies — apply `reward` to
//      the bank and return.
//   7. If the threat survives the fire, every unit that fired loses 1
//      HP (the "repel" cost). Killed units (HP <= 0) are removed.
//   8. The leftover damage is applied to the impact tile. Units stacked
//      on the tile (in placement order, oldest first) absorb up to
//      their current HP each before the next; whatever's left after
//      the stack reduces the building's HP (clamped at 1 — buildings
//      can't be destroyed, per D15).
//   9. If the threat still has HP > 0, advance to the next occupied
//      cell on the path and repeat from step 5 (with no further unit
//      fires from already-spent units; this iteration only does stack/
//      building damage). The "fire" volley happens once per threat.
//   10. If the path reaches center with HP > 0, run `centerBurn` to
//       drain the village vault.

import type { SettlementState } from '../types.ts';
import type {
  ThreatCard,
  TrackCardDef,
  ModifierCard,
  BoonCard,
  PlacementBonus,
} from '../../data/schema.ts';
import { UNITS } from '../../data/index.ts';
import type { UnitDef } from '../../data/schema.ts';
import type { RandomAPI } from '../random.ts';
import type { UnitInstance } from '../roles/defense/types.ts';
import type { DomesticBuilding } from '../roles/domestic/types.ts';
import { SKILLS, type SkillID } from '../roles/science/skills.ts';
import { RESOURCES, type Resource, type ResourceBag } from '../resources/types.ts';
import { appendBankLog } from '../resources/bankLog.ts';
import { dispatch } from '../events/dispatcher.ts';
import type { EventCardDef } from '../events/state.ts';
import type { EventEffect } from '../events/effects.ts';
import {
  computeGridBounds,
  computePath,
  occupiedPath,
  parseCellKey,
  tileCoversPath,
  type Cell,
} from './path.ts';
import { centerBurn } from './centerBurn.ts';
import { resolveBoss } from './boss.ts';
import type { ResolveTrace } from '../track.ts';

// Effective stats for a unit at fire time, after folding placement
// bonuses, taught skills, and the optional drill token. Pure data —
// the resolver builds one of these per unit per resolve call.
interface EffectiveStats {
  strength: number;
  range: number;
  hp: number;
  firstStrike: boolean;
}

const findUnitDef = (defID: string): UnitDef | undefined =>
  UNITS.find((u) => u.name === defID);

/** Fold a single placement-bonus effect onto the running stats bag. */
const applyPlacementEffect = (
  stats: EffectiveStats,
  bonus: PlacementBonus,
): void => {
  const e = bonus.effect;
  switch (e.kind) {
    case 'strength':
      stats.strength += e.amount;
      return;
    case 'range':
      stats.range += e.amount;
      return;
    case 'regen':
      // Regen is round-end bookkeeping, not fire-time math; ignored
      // here. The end-of-round hook (Phase 2.8) reads it directly.
      return;
    case 'hp':
      // HP modifiers from placement bonuses bump the unit's effective
      // max HP — but per-instance HP is tracked separately on the
      // UnitInstance, so we don't fold the bump here. Phase 2.5 (the
      // place move) will add the +HP to the instance at place time.
      return;
    case 'firstStrike':
      stats.firstStrike = true;
      return;
  }
};

/**
 * Compute a unit's effective stats for a single fire against `threat`.
 * Folds:
 *   - the unit def's printed stats,
 *   - the placement bonus matching the building underneath the unit,
 *   - taught skills (D27) — applied as a flat numeric bump per skill,
 *   - one-shot drill (+1 strength) when the token is set,
 *   - matchup keywords (`unit.note` text containing "vs <Keyword> +N"
 *     when `threat.modifiers` includes the keyword) — V1 implementation
 *     is permissive: the resolver scans the unit's printed `note` for a
 *     "vs <keyword> +N" pattern. Future content can replace this with
 *     a structured field on UnitDef.
 */
const computeStats = (
  unit: UnitInstance,
  def: UnitDef,
  building: DomesticBuilding | undefined,
  threat: ThreatCard,
): EffectiveStats => {
  const stats: EffectiveStats = {
    strength: def.attack,
    range: def.range,
    hp: unit.hp,
    firstStrike: def.firstStrike,
  };

  // Placement bonuses — match `BuildingDef.name` to the placed defID.
  if (building !== undefined && !building.isCenter) {
    for (const bonus of def.placementBonus) {
      if (bonus.buildingDefID === building.defID) {
        applyPlacementEffect(stats, bonus);
      }
    }
  }

  // Taught skills (D27) — durable per-instance bumps. Phase 2.6 wires
  // these through the same `PlacementEffect` taxonomy as placement
  // bonuses, so a single applier (`applyPlacementEffect`) handles both
  // shapes. Skills whose effects are off-fire (`reinforce` bumps hp at
  // teach time; `accelerate` lives on the round-end regen path) collapse
  // into no-ops here per `applyPlacementEffect`'s switch.
  const taught = unit.taughtSkills ?? [];
  for (const s of taught) {
    const skill = SKILLS[s as SkillID];
    if (skill === undefined) continue;
    applyPlacementEffect(stats, { buildingDefID: '', effect: skill.effect });
  }

  // Matchup keywords. We scan `def.note` for a "+N vs <keyword>" pattern
  // (case-insensitive) and apply the bump when the threat carries the
  // matching modifier. Soft pattern: deliberate so authors can write
  // free-form effect lines while the resolver picks up the explicit
  // bonus.
  const note = (def.note ?? '').toLowerCase();
  const tags = threat.modifiers ?? [];
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    // Match either "+N vs <tag>" or "vs <tag> +N".
    const re1 = new RegExp(`\\+(\\d+)\\s+vs\\s+${lower}\\b`, 'i');
    const re2 = new RegExp(`\\bvs\\s+${lower}\\s*\\+(\\d+)`, 'i');
    const m = re1.exec(note) ?? re2.exec(note);
    if (m && m[1] !== undefined) {
      const bump = Number(m[1]);
      if (Number.isFinite(bump)) stats.strength += bump;
    }
  }

  // Drill token — +1 strength on this fire. Per spec D27, drill is
  // *always* additive after every other modifier (placement bonus,
  // taught skills, matchup keywords) so its effect is unconditional —
  // no other source can mask or cap the bump. Apply it last.
  if (unit.drillToken === true) {
    stats.strength += 1;
  }

  if (stats.strength < 0) stats.strength = 0;
  if (stats.range < 0) stats.range = 0;
  return stats;
};

/**
 * Order firing units: first-strike before non-first-strike, then by
 * placement order within each tier. Stable across runs because
 * `placementOrder` is monotonic and assigned at place time.
 */
const orderFire = (
  units: ReadonlyArray<{ unit: UnitInstance; stats: EffectiveStats }>,
): Array<{ unit: UnitInstance; stats: EffectiveStats }> => {
  return [...units].sort((a, b) => {
    const af = a.stats.firstStrike ? 0 : 1;
    const bf = b.stats.firstStrike ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.unit.placementOrder - b.unit.placementOrder;
  });
};

/**
 * Append a trace onto `G.track.traces` and update `G.track.lastResolve`.
 * Lazy-initializes both slots; safe to call when `G.track` is missing
 * (some test fixtures don't seed a track). Defense redesign 3.3.
 */
const publishTrace = (G: SettlementState, trace: ResolveTrace): void => {
  if (G.track === undefined) return;
  if (G.track.traces === undefined) G.track.traces = [];
  G.track.traces.push(trace);
  G.track.lastResolve = trace;
};

/**
 * Resolve a single threat card against `G`. Mutates `G` in place. See
 * the file-level comment for the full algorithm.
 *
 * Exported so the Phase 2.7 boss resolver can dispatch its scripted
 * attack pattern through the same pipeline (each boss attack synthesizes
 * a `ThreatCard` and feeds it through here).
 *
 * Defense redesign 3.3 — also fills `G.track.lastResolve` and pushes
 * onto `G.track.traces` so the UI can replay the path animation.
 */
export const resolveThreat = (
  G: SettlementState,
  random: RandomAPI,
  threat: ThreatCard,
): void => {
  // Resolver consults the domestic grid + defense instances. If either
  // is missing we degenerate cleanly — no fires, threat heads straight
  // to center.
  const grid = G.domestic?.grid ?? {};
  const inPlay = G.defense?.inPlay ?? [];

  const bounds = computeGridBounds(grid);
  const path = computePath(threat.direction, threat.offset, bounds);

  // First impact tile — the first occupied non-center cell on the path.
  // The path always ends at center, so if no occupied tiles intervene,
  // `firstImpactKey` is null and the threat goes straight to center.
  const occupied = occupiedPath(path, grid);
  const firstImpactKey: string | null = occupied[0] ?? null;

  // Compute fire eligibility against the path *up to and including* the
  // first impact tile (or the entire path when no impact tile exists —
  // the spec says "between entry and first impact"; with no impact the
  // resolver still lets units in range fire as the threat passes
  // through their reach).
  const fireSlice: Cell[] = (() => {
    if (firstImpactKey === null) return [...path];
    const cut: Cell[] = [];
    for (const cell of path) {
      cut.push(cell);
      const k = `${cell.x},${cell.y}`;
      if (k === firstImpactKey) break;
    }
    return cut;
  })();

  // Build the firing-unit list.
  const candidates: Array<{ unit: UnitInstance; stats: EffectiveStats }> = [];
  for (const unit of inPlay) {
    const def = findUnitDef(unit.defID);
    if (def === undefined) continue;
    const tile = parseCellKey(unit.cellKey);
    if (tile === null) continue;
    const building = grid[unit.cellKey];
    const stats = computeStats(unit, def, building, threat);
    if (!tileCoversPath(tile, stats.range, fireSlice)) continue;
    candidates.push({ unit, stats });
  }
  const fires = orderFire(candidates);

  // Defense redesign 3.3 — accumulators for the playback trace. We track
  // every cell the threat actually crossed (kept in path order) so the
  // overlay can paint the highlighted lane, plus the unit ids that
  // fired and the impact-tile keys the threat actually consumed.
  const tracePath: Array<{ x: number; y: number }> = [];
  const traceFiringUnitIDs: string[] = [];
  const traceImpactTiles: string[] = [];
  let traceCenterBurned: number | undefined;
  // Defense redesign 3.4 — per-resource breakdown the banner reads to
  // render "−3 wood, −1 stone" without re-deriving from `bankLog`.
  let traceCenterBurnDetail: Partial<ResourceBag> | undefined;

  // Run the fire volley. Each fire deducts strength from the threat;
  // bail early when threat dies. Track which units fired so we can
  // apply the "repel" 1-HP cost if the threat survives.
  let hp = threat.strength;
  const firedUnits: UnitInstance[] = [];
  for (const { unit, stats } of fires) {
    if (hp <= 0) break;
    hp -= stats.strength;
    firedUnits.push(unit);
    traceFiringUnitIDs.push(unit.id);
    // Drill token consumes on fire whether or not the threat dies.
    if (unit.drillToken === true) {
      unit.drillToken = false;
    }
  }

  if (hp <= 0) {
    // Threat killed before reaching the first impact tile. The trace
    // covers the fire-slice (entry through the first impact tile) so the
    // overlay can paint "the threat got this far before going down."
    for (const cell of fireSlice) {
      tracePath.push({ x: cell.x, y: cell.y });
    }
    if (threat.reward !== undefined) {
      const delta: Partial<Record<string, number>> = {};
      let any = false;
      for (const r of RESOURCES) {
        const v = threat.reward[r];
        if (v === undefined || v === 0) continue;
        G.bank[r] += v;
        delta[r] = v;
        any = true;
      }
      if (any) {
        appendBankLog(G, 'threatReward', delta, `Threat ${threat.id} repelled`);
      }
    }
    publishTrace(G, {
      pathTiles: tracePath,
      firingUnitIDs: traceFiringUnitIDs,
      impactTiles: traceImpactTiles,
      outcome: 'killed',
    });
    return;
  }

  // Threat survives the fire. Every unit that fired absorbs 1 HP.
  for (const unit of firedUnits) {
    unit.hp -= 1;
  }
  // Remove any unit that just died.
  if (G.defense !== undefined) {
    G.defense.inPlay = G.defense.inPlay.filter((u) => u.hp > 0);
  }

  // Now apply the leftover damage to the path's impact tiles. The
  // resolver walks `occupied` cells in path order; at each tile the
  // damage is consumed by the unit stack (placement order, bottom-up)
  // before reducing the building's HP.
  let damage = hp;
  for (const cellKeyStr of occupied) {
    if (damage <= 0) break;
    const building = grid[cellKeyStr];
    if (building === undefined) continue;
    if (building.isCenter === true) continue;

    // Stack consumption — every (still-alive) unit on this tile in
    // placement order absorbs up to its current HP.
    const stack = (G.defense?.inPlay ?? [])
      .filter((u) => u.cellKey === cellKeyStr)
      .sort((a, b) => a.placementOrder - b.placementOrder);
    let touched = false;
    for (const unit of stack) {
      if (damage <= 0) break;
      const absorb = Math.min(unit.hp, damage);
      unit.hp -= absorb;
      damage -= absorb;
      touched = true;
    }
    // Remove any units killed by stack absorption.
    if (G.defense !== undefined) {
      G.defense.inPlay = G.defense.inPlay.filter((u) => u.hp > 0);
    }

    if (damage > 0) {
      // Then the building. Buildings can't be destroyed; clamp at 1.
      const newHp = Math.max(1, building.hp - damage);
      const absorbed = building.hp - newHp;
      if (absorbed > 0) touched = true;
      building.hp = newHp;
      damage -= absorbed;
    }

    if (touched) traceImpactTiles.push(cellKeyStr);
    if (damage <= 0) break;
  }

  // The path the trace covers depends on where the threat ended up:
  //   - reached center → cover the entire computed `path`.
  //   - died en route  → cover up to (and including) the last impact
  //                       tile; that's the threat's furthest-traversed
  //                       cell.
  // Reaching this point implies `damage > 0` survived the fire volley
  // (the kill branch returned earlier), so the impact loop must have
  // either consumed all `damage` (=> at least one tile in
  // `traceImpactTiles`) or left some for the center burn (`damage > 0`
  // here). The two branches below cover both — there is no third case.
  if (damage > 0) {
    for (const cell of path) tracePath.push({ x: cell.x, y: cell.y });
  } else {
    const lastKey = traceImpactTiles[traceImpactTiles.length - 1]!;
    for (const cell of path) {
      tracePath.push({ x: cell.x, y: cell.y });
      const k = `${cell.x},${cell.y}`;
      if (k === lastKey) break;
    }
  }

  // If the path reached center with damage left, burn the pool. Capture
  // the burn total for the trace so the UI can render the ripple at the
  // appropriate intensity.
  if (damage > 0) {
    const burned = centerBurn(
      G,
      random,
      damage,
      `Threat ${threat.id} (${threat.name})`,
    );
    let total = 0;
    const detail: Partial<ResourceBag> = {};
    for (const r of RESOURCES as ReadonlyArray<Resource>) {
      const v = burned[r];
      if (v === undefined || v === 0) continue;
      total += v;
      detail[r] = v;
    }
    traceCenterBurned = total;
    // Only attach the per-resource breakdown when the burn actually
    // consumed tokens — an empty pool produces `total === 0` and no
    // detail entries, in which case the banner has nothing to surface.
    if (total > 0) {
      traceCenterBurnDetail = detail;
    }
  }

  const outcome: ResolveTrace['outcome'] =
    damage > 0
      ? 'reachedCenter'
      : traceImpactTiles.length > 0
        ? 'overflowed'
        : 'killed';

  const trace: ResolveTrace = {
    pathTiles: tracePath,
    firingUnitIDs: traceFiringUnitIDs,
    impactTiles: traceImpactTiles,
    outcome,
  };
  if (traceCenterBurned !== undefined) {
    trace.centerBurned = traceCenterBurned;
  }
  // Defense redesign 3.4 — surface the per-resource breakdown + the
  // offending card name + the round so the banner can render
  // "−3 wood, −1 stone burned to ⚔ Cyclone (round 14)" without reaching
  // back into `bankLog`. Only populated when the burn actually consumed
  // tokens (so an empty-pool resolve emits no banner).
  if (traceCenterBurnDetail !== undefined) {
    trace.centerBurnDetail = traceCenterBurnDetail;
    trace.centerBurnSource = threat.name;
    trace.centerBurnRound = G.round;
  }
  publishTrace(G, trace);
};

/** Modifier-kind effects that the event dispatcher consumes via
 *  `hasModifierActive` / `consumeModifier`. Track-flipped modifier cards
 *  carry one of these as their `effect`; the resolver pushes the effect
 *  onto `G._modifiers` so the conditioned moves see it. */
const MODIFIER_KINDS: ReadonlySet<EventEffect['kind']> = new Set([
  'doubleScience',
  'forbidBuy',
  'forceCheapestScience',
]);

/**
 * Push a `modifier` track card's effect onto `G._modifiers` so the
 * existing dispatcher-side consumers see it, and record the card on
 * `G.track.activeModifiers` so the round-end hook can expire any
 * unconsumed entries.
 */
const pushModifier = (G: SettlementState, card: ModifierCard): void => {
  if (G.track === undefined) return;
  if (G.track.activeModifiers === undefined) G.track.activeModifiers = [];
  G.track.activeModifiers.push(card);

  const effect = card.effect as EventEffect | undefined;
  if (effect === undefined || !MODIFIER_KINDS.has(effect.kind)) return;
  if (G._modifiers === undefined) G._modifiers = [];
  G._modifiers.push(effect);
};

/** Defense redesign 3.3 — emit a degenerate trace for non-threat flips
 *  (boon / modifier). The path overlay uses `outcome: 'noop'` to skip
 *  the lane animation while still letting the strip blink + the event
 *  log advance. */
const publishNoopTrace = (G: SettlementState): void => {
  publishTrace(G, {
    pathTiles: [],
    firingUnitIDs: [],
    impactTiles: [],
    outcome: 'noop',
  });
};

/**
 * Apply a `boon` track card by reusing the event-effect dispatcher. The
 * dispatcher expects an `EventCardDef`, so we wrap the boon's printed
 * effect into a synthetic single-effect card. Color is set to `'gold'`
 * because boons that gain bank resources go to the chief's pool — this
 * matches the retired wander-deck behavior.
 */
const dispatchBoon = (
  G: SettlementState,
  random: RandomAPI,
  card: BoonCard,
): void => {
  // Wrap the boon as a single-effect event card. The dispatcher takes
  // the effects array off `card.effects`; we synthesize a minimal one.
  const synthetic: EventCardDef = {
    id: `track-boon:${card.id}`,
    name: card.name,
    color: 'gold',
    effects: [card.effect],
  };
  // The dispatcher is permissive about ctx (typed as `unknown`); we
  // pass `undefined` since the resolver isn't inside a stage move with
  // events plumbing available. Boon effects in TRACK_CARDS are
  // resource gains today, which don't need the stage transition path.
  dispatch(G, undefined, random, synthetic);
};

/**
 * Single entry point. Routes each `TrackCardDef` to its sub-resolver.
 * Mutates `G` in place. The boss case dispatches to `./boss.ts` —
 * Phase 2.7 lands the real implementation that flips `G.bossResolved`
 * after running the printed attack pattern (D21, D25).
 */
export const resolveTrackCard = (
  G: SettlementState,
  random: RandomAPI,
  card: TrackCardDef,
): void => {
  switch (card.kind) {
    case 'boon':
      dispatchBoon(G, random, card);
      publishNoopTrace(G);
      return;
    case 'modifier':
      pushModifier(G, card);
      publishNoopTrace(G);
      return;
    case 'threat':
      resolveThreat(G, random, card);
      return;
    case 'boss':
      resolveBoss(G, random, card);
      return;
  }
};
