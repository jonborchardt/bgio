# Issue 017 — `trackCards.json` ships zero `modifier` cards

**Status**: open. Stale plan rewritten 2026-05-07 for a fresh-context handoff.

**Severity**: medium
**Area**: data + engine
**Effort**: medium (content + new effect kinds + runtime hooks)

## Background

A track card is one of four kinds:

| kind | what it does on flip |
|---|---|
| `threat` | walks a path, units fire, leftover damage hits buildings or burns the vault |
| `boon` | applies a printed effect (gain resources, draw cards, etc.) |
| `modifier` | bends a rule for one round (e.g. "no events this round", "produce halved") |
| `boss` | terminal phase-10 card; flips win |

The active deck (`card-decks/06-merged-best/trackCards.json`) ships
**13 boons + 20 threats + 1 boss + 0 modifiers**. Every other deck
under `card-decks/` has the same gap; the `06-merged-best` REPORT.md
explicitly notes "trackCards.json is untouched."

## What the engine has already

- **Schema** ([`src/data/schema.ts:77`](../src/data/schema.ts)) —
  `ModifierCard extends TrackCardBase` is fully typed:
  `{ kind: 'modifier', durationRounds, effect: unknown }`.
- **Validator** ([`src/data/schema.ts:821`](../src/data/schema.ts)
  `validateTrackCards`) accepts `kind: 'modifier'` rows.
- **Resolver** ([`src/game/track/resolver.ts:517`](../src/game/track/resolver.ts)
  `pushModifier`) appends the card onto `G.track.activeModifiers`
  when `chiefFlipTrack` flips a modifier-kind card.
- **Round-end cleanup**
  ([`src/game/roles/defense/hooks.ts:99`](../src/game/roles/defense/hooks.ts)
  `defense:clear-modifiers`) clears `G.track.activeModifiers` at
  end of round AND removes the matching entry from `G._modifiers`
  (the dispatcher's per-effect-kind queue).
- **Dispatcher seam**
  ([`src/game/events/dispatcher.ts:193`](../src/game/events/dispatcher.ts)
  `hasModifierActive(G, kind)` and `consumeModifier(G, kind)`) is
  the single read/consume API for modifier-conditioned moves.

## What's missing

### 1. No content

No JSON entry has `kind: 'modifier'`. The deck has nowhere to flip
one *from*.

### 2. No `EventEffect` shapes for rule-bends

The current `EventEffect` union
([`src/game/events/effects.ts:21`](../src/game/events/effects.ts))
is only:

```ts
export type EventEffect =
  | { kind: 'gainResource'; bag: Partial<ResourceBag>; target: 'bank' | 'stash' }
  | { kind: 'addEventCard'; cardID: string }
  | { kind: 'awaitInput'; prompt: string; payloadKind: string };
```

None of these are rule-bends. To author a card like "next threat
strength +1" or "no events this round" you need to add new
discriminated variants — e.g.
`| { kind: 'threatStrengthBump'; amount: number }`.

### 3. No runtime hooks read `activeModifiers` to bend a rule

`pushModifier` stores the card. `hasModifierActive` / `consumeModifier`
are exported. But **no production move or hook actually calls them**.
The defense round-end hook only *clears* the array; nothing reads it
between flip and end-of-round.

That's the load-bearing gap. A modifier authored today would sit on
`activeModifiers`, get cleared at round-end, and have zero observable
effect.

## Fix sketch

Pick three concrete modifier cards first; let the cards drive the
effect-kind list rather than over-spec'ing the union.

### Step 1 — pick 3 modifier cards

Suggested triplet (each touches a different runtime site):

| name | phase | effect (proposed shape) | runtime site |
|---|---|---|---|
| **Storm Warning** | mid (4–6) | `{ kind: 'threatStrengthBump'; amount: 1 }` | `track/resolver.ts` `resolveThreat` reads + consumes before computing damage |
| **Quiet Council** | mid (5–7) | `{ kind: 'suppressEventsThisRound' }` | per-color `*PlayEvent` moves bail INVALID_MOVE if `hasModifierActive(G, 'suppressEventsThisRound')` |
| **Bountiful Harvest** | early (2–4) | `{ kind: 'doubleProduceThisRound' }` | `phases/others.ts` `runProduceForSeat` reads + doubles bag |

### Step 2 — extend `EventEffect`

Add the three new variants to the union in
[`src/game/events/effects.ts`](../src/game/events/effects.ts).
The `dispatch()` function only handles `gainResource` etc. today —
it doesn't need to handle modifier kinds because `pushModifier`
bypasses the dispatcher entirely. But TypeScript will demand
exhaustiveness in `dispatch`'s switch; add `case 'threatStrengthBump':
break;` (no-op) for each new kind so the dispatcher compiles.

### Step 3 — wire the runtime sites

For each card pick the right hook:

- **threatStrengthBump** — in
  [`src/game/track/resolver.ts`](../src/game/track/resolver.ts)
  `resolveThreat`, before computing `hp = threat.strength`, call
  `consumeModifier(G, 'threatStrengthBump')` and bump `hp`
  accordingly. (One-shot per modifier card, hence consume.)
- **suppressEventsThisRound** — in each `*PlayEvent` move under
  `src/game/roles/<role>/`, return `INVALID_MOVE` when
  `hasModifierActive(G, 'suppressEventsThisRound')` is true. Don't
  consume — the effect lasts the whole round, and the round-end
  cleanup clears `activeModifiers` for us.
- **doubleProduceThisRound** — in
  [`src/game/phases/others.ts`](../src/game/phases/others.ts)
  `runProduceForSeat`, double the produce bag if
  `hasModifierActive(G, 'doubleProduceThisRound')`.

### Step 4 — author the cards

Add three `kind: 'modifier'` entries to **every** deck under
`card-decks/<deck>/trackCards.json` (00-initial, 01-…, 06-merged-best).
The fixture deck under `tests/fixtures/deck/trackCards.json` should
get them too so the existing track tests exercise the kind. Each
card needs:

```json
{
  "id": "trk-p4-storm-warning",
  "kind": "modifier",
  "name": "Storm Warning",
  "phase": 4,
  "durationRounds": 1,
  "description": "The next threat strikes harder. Threat strength +1 this round.",
  "effect": { "kind": "threatStrengthBump", "amount": 1 }
}
```

`durationRounds` is always 1 today (the round-end hook clears the
slot unconditionally); the schema field exists for a future
multi-round modifier.

### Step 5 — tighten the validator

[`src/data/schema.ts:821`](../src/data/schema.ts) `validateTrackCards`
already lets `kind: 'modifier'` through but doesn't validate
`effect.kind` against the new union. Tighten it: when
`card.kind === 'modifier'`, check `card.effect.kind` is one of the
new variants and reject anything else with a clear message.

## Acceptance

- `card-decks/06-merged-best/trackCards.json` has ≥ 3 modifier cards
  spread across mid phases.
- The fixture deck has the same modifier cards (so the test suite
  exercises the path).
- A new test under `tests/game/track/modifier-dispatch.test.ts`
  covers each modifier kind end-to-end:
  - flip the card via `chiefFlipTrack`
  - verify `G.track.activeModifiers.length === 1`
  - drive the conditioned move (resolveThreat / playEvent / produce)
  - verify the rule actually bent (damage bumped, event rejected,
    produce doubled)
  - end the round, verify cleanup wiped `activeModifiers`.
- `npm test` + `npm run typecheck` + `npm run lint` all green.

## Files to touch

- `card-decks/<each>/trackCards.json` — author cards.
- `tests/fixtures/deck/trackCards.json` — author cards.
- [`src/game/events/effects.ts`](../src/game/events/effects.ts) — extend `EventEffect`.
- [`src/game/events/dispatcher.ts`](../src/game/events/dispatcher.ts) — add no-op cases for the new kinds.
- [`src/data/schema.ts`](../src/data/schema.ts) `validateTrackCards` — validate `effect.kind`.
- [`src/game/track/resolver.ts`](../src/game/track/resolver.ts) `resolveThreat` — read + consume `threatStrengthBump`.
- `src/game/roles/<role>/<color>PlayEvent.ts` — gate on `suppressEventsThisRound`.
- [`src/game/phases/others.ts`](../src/game/phases/others.ts) `runProduceForSeat` — gate on `doubleProduceThisRound`.
- New: `tests/game/track/modifier-dispatch.test.ts`.

## Related

- [008](issue-008-library-content-overshoots-target.md) (closed —
  superseded by deck swap; modifier authoring is the deck's REPORT
  open follow-up)
- [019](issue-019-tech-content-onplay-effects-coverage.md) (sibling
  content gap — techs have the same "schema supports it, content
  doesn't fill it" pattern)
