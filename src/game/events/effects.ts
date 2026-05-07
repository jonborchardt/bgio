// 08.2 — Typed `EventEffect` discriminated union.
//
// Effect data lives on `EventCardDef.effects` (today loaded as `unknown[]`
// from `src/data/events.json` — see the schema-note in
// src/data/events.ts). The dispatcher in `dispatcher.ts` casts those
// entries to `EventEffect[]` at the boundary, so any drift between JSON
// content and this union surfaces at dispatch time as an "unknown effect
// kind: ..." throw.
//
// New effect kinds should be added here first, then implemented in
// dispatcher.ts. Effects fall into three buckets:
//
//   - Immediate / deterministic: applied directly during dispatch
//     (`gainResource`, `addEventCard`).
//   - Awaiting-input: stashed on `G._awaitingInput[playerID]` and
//     resolved by a follow-up `eventResolve(payload)` move
//     (generic `awaitInput`).
//   - Modifier / passive: don't mutate G during dispatch — they're
//     queried by other moves at the right time (`hasModifierActive` /
//     `consumeModifier` for round-scoped rule bends pushed by track
//     `modifier` cards; `techPassives` for per-tech bonuses layered on
//     fire / produce). The dispatcher's case for these is a no-op so
//     they can be authored on tech cards' `onPlayEffects` without
//     side-effects at play time — the effect's value is its presence
//     in the queue, not its dispatch.

import type { ResourceBag } from '../resources/types.ts';

// Stat targets for `unitStatBump` — kept in sync with `PlacementEffect`'s
// numeric kinds so a tech can bump strength / range / hp / regen on units
// without introducing a parallel taxonomy.
export type UnitStatKind = 'strength' | 'range' | 'hp' | 'regen';

export type EventEffect =
  | { kind: 'gainResource'; bag: Partial<ResourceBag>; target: 'bank' | 'stash' }
  | { kind: 'addEventCard'; cardID: string }
  | { kind: 'awaitInput'; prompt: string; payloadKind: string }
  // Issue 017 — track-card modifiers. Pushed onto `G._modifiers` by the
  // resolver's `pushModifier` and consumed by the conditioned move:
  //   - `threatStrengthBump` is consumed by the next `resolveThreat`
  //     (one-shot per modifier card).
  //   - `suppressEventsThisRound` is queried but not consumed by
  //     `*PlayEvent` moves — the round-end hook clears it.
  //   - `doubleProduceThisRound` is queried but not consumed by
  //     `runProduceForSeat` — same lifetime as suppress.
  | { kind: 'threatStrengthBump'; amount: number }
  | { kind: 'suppressEventsThisRound' }
  | { kind: 'doubleProduceThisRound' }
  // Issue 019 — tech-passive shapes. Read by `techPassives(G, holder)`
  // at fire / produce time:
  //   - `unitStatBump` layers a flat bump on a unit's effective stats
  //     in `resolver.computeStats`. `matchUnit` (when set) restricts
  //     the bump to a unit by `defID`; absent means "every unit the
  //     holder has in play".
  //   - `producePerRound` is summed into the produce bag in
  //     `runProduceForSeat` for any seat that holds the role
  //     containing the tech.
  //   - `unlockCard` adds an extra named building / unit to the
  //     matching role's hand on play, beyond what
  //     `tech.buildings`/`tech.units` text fields already grant.
  | {
      kind: 'unitStatBump';
      stat: UnitStatKind;
      amount: number;
      matchUnit?: string;
    }
  | { kind: 'producePerRound'; bag: Partial<ResourceBag> }
  | { kind: 'unlockCard'; ref: string; refKind: 'building' | 'unit' };
