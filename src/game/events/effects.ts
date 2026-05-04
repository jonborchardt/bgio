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
//   - Modifier: pushed onto `G._modifiers` and consumed later by the move
//     it conditions (`doubleScience`, `forbidBuy`, `forceCheapestScience`).
//   - Awaiting-input: stashed on `G._awaitingInput[playerID]` and
//     resolved by a follow-up `eventResolve(payload)` move
//     (`swapTwoScienceCards`, generic `awaitInput`).

import type { ResourceBag } from '../resources/types.ts';

export type EventEffect =
  | { kind: 'gainResource'; bag: Partial<ResourceBag>; target: 'bank' | 'stash' }
  | { kind: 'doubleScience' } // sci pays 2x advancement this turn
  | { kind: 'forbidBuy' } // sci can't complete a card this turn
  | { kind: 'forceCheapestScience' }
  | { kind: 'swapTwoScienceCards' } // requires user pick — uses awaitInput flow
  | { kind: 'addEventCard'; cardID: string } // appends to a color deck
  | { kind: 'awaitInput'; prompt: string; payloadKind: string };
