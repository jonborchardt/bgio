# Issue 019 — Tech `onPlayEffects` coverage is 0%

**Status**: open. Stale plan rewritten 2026-05-07 for a fresh-context handoff.

**Severity**: medium
**Area**: data + (likely) engine
**Effort**: large (content-heavy)

## Background

A tech card flows through the engine in three stages:

1. **Acquire** — when `scienceLibraryBuy` routes a tech to a role's
   hand, the engine fires the tech's `onAcquireEffects`.
2. **Play** — when the holder dispatches `chiefPlayTech` /
   `sciencePlayTech` / `domesticPlayTech` / `defensePlay` (red), the
   engine fires `onPlayEffects`.
3. **Passive** — `passiveEffects` is read by `techPassives(G, holder)`
   and consulted at fire/spend/produce time so per-card bonuses
   layer onto dispatched effects.

The active deck (`card-decks/06-merged-best/technologies.json`,
**86 techs**) has:

- `onPlayEffects` on **0 / 86** techs.
- `onAcquireEffects` on **0 / 86** techs.
- `passiveEffects` on **0 / 86** techs.

Every other deck under `card-decks/` has the same gap.

## What playing a tech does today

`<role>PlayTech` walks this path
([`src/game/tech/effects.ts:162`](../src/game/tech/effects.ts)
`applyTechOnPlay`):

1. If `tech.onPlayEffects` is set → dispatch each effect (gain
   resources, etc.).
2. **Always**: walk `tech.buildings` / `tech.units` strings and
   grant the named unlocks to the right role's hand
   (`grantTechUnlocks`). This is derived from the tech's text
   fields, not from `onPlayEffects`, and is the only mechanical
   payoff today.

So today, **playing a tech**:
- ✓ removes the card from hand
- ✓ adds buildings / units named in `tech.buildings` / `tech.units`
  to the matching role's hand
- ✓ leaves a permanent discount marker on the science seat's
  tableau (set at acquire time)
- ✗ does **nothing else** — no resource bumps, no flat bonuses, no
  rule-bends, no passive auras

For ~half the deck (techs with no unlocks named), playing the tech
is purely cosmetic. The gap matters most for techs whose printed
text describes a numeric or rule effect ("+1 unit range", "double
event-card draw", etc.) — those are inert.

## What the engine has already

- **Schema**
  ([`src/data/schema.ts:255`](../src/data/schema.ts)) —
  `TechnologyDef` carries optional `onAcquireEffects`,
  `onPlayEffects`, `passiveEffects` (each `unknown[]` validated by
  the loader).
- **Validator**
  ([`src/data/schema.ts:647`](../src/data/schema.ts)
  `validateTechnologies`) routes each effect array through
  `optionalEffectsArray` which accepts the `EventEffect` shape.
- **Effect-application path** — three exported functions in
  [`src/game/tech/effects.ts`](../src/game/tech/effects.ts):
  `applyTechOnAcquire`, `applyTechOnPlay`, and `techPassives`
  (passive aggregation).
- **`scienceLibraryBuy` already calls `applyTechOnAcquire`** at
  routing time, so any `onAcquireEffects` we author land on day one.
- **Per-role play moves already call `applyTechOnPlay`** at play
  time — see `src/game/roles/defense/play.ts:139`,
  `src/game/roles/<role>/playTech.ts`.

## What's missing

### 1. Content — every tech has empty effect arrays

86 techs × 3 effect arrays = 258 missing JSON entries. The work is
authoring, but it's also design: each tech's note describes an
effect, and the author has to translate that into the typed
`EventEffect` shape.

### 2. The `EventEffect` taxonomy is too narrow

The current union
([`src/game/events/effects.ts:21`](../src/game/events/effects.ts)):

```ts
export type EventEffect =
  | { kind: 'gainResource'; bag: Partial<ResourceBag>; target: 'bank' | 'stash' }
  | { kind: 'addEventCard'; cardID: string }
  | { kind: 'awaitInput'; prompt: string; payloadKind: string };
```

Plenty of techs need shapes that don't exist yet:

- Numeric bumps to per-unit stats (`+1 unit range`, `+2 strength on
  walls`) → no shape.
- Per-round caps (`+1 produce on a building`) → no shape.
- Conditional triggers (`when a threat reaches center, refund 1 wood`)
  → no shape.
- Discount-tableau effects beyond the standard −1 from buying →
  no shape.

Some techs map cleanly to `gainResource`. Many don't.

## Fix sketch

This is large; structure it as three phases.

### Phase A — author what's mappable today (~3 hours)

For every tech whose printed effect maps to `gainResource` (the
Foraging-type "+2 gold" tier-1 cards), add the JSON. Sample:

```json
{
  "name": "Foraging",
  "tier": 1,
  "scienceColor": "gold",
  "note": "On play: chief gains 2 gold.",
  "onPlayEffects": [
    { "kind": "gainResource", "bag": { "gold": 2 }, "target": "bank" }
  ]
}
```

Estimate: ~30 of 86 techs have notes that resolve to a single
`gainResource`. That's the cheapest content win.

### Phase B — extend the effect taxonomy (~half a day)

Pick the next 3 most-needed shapes and add them to
`EventEffect`. Suggested triplet:

| kind | shape | example tech |
|---|---|---|
| `unitStatBump` | `{ kind: 'unitStatBump'; stat: 'strength'\|'range'\|'hp'; amount: number; matchUnit?: string }` | "Sharpshooting: archers +1 range" |
| `producePerRound` | `{ kind: 'producePerRound'; bag: Partial<ResourceBag> }` | "Cooking: +1 food per round" |
| `unlockCard` | `{ kind: 'unlockCard'; ref: string }` | covers techs whose text names an unlock the `tech.buildings` / `tech.units` string fields don't capture cleanly |

Each new variant needs:

- Add to the `EventEffect` union in
  [`src/game/events/effects.ts`](../src/game/events/effects.ts).
- Add a case to `dispatch()` in
  [`src/game/events/dispatcher.ts`](../src/game/events/dispatcher.ts)
  (the function is exhaustive over the union).
- Decide where the runtime reads it:
  - `unitStatBump` — fire-time read in
    [`src/game/track/resolver.ts`](../src/game/track/resolver.ts)
    `computeStats`, layered onto placement bonuses.
  - `producePerRound` — read in
    [`src/game/phases/others.ts`](../src/game/phases/others.ts)
    `runProduceForSeat`, summed into the produce bag.
  - `unlockCard` — extend `grantTechUnlocks` in
    [`src/game/tech/effects.ts`](../src/game/tech/effects.ts).

The runtime sites need to consult `techPassives(G, holder)` (already
exported) to find every active passive effect of the right kind, not
just the dispatched onPlay effect.

### Phase C — author the rest of the deck (~day)

With Phase B's shapes in hand, walk every tech and author its effect
list. Rule of thumb:

- Tier 1 techs: 1 effect each. Usually `gainResource` or a small
  passive.
- Tier 2 techs: 1–2 effects.
- Tier 3 techs: 1–2 effects, often a bigger numeric or a new
  unlock + a passive.
- Pure-flavor techs (no mechanical effect described): leave all
  three arrays empty AND remove them from the library deck (the
  validator can flag this — see acceptance below).

## Acceptance

- 100% of the techs in `card-decks/06-merged-best/technologies.json`
  either:
  - (a) carry at least one entry across `onAcquireEffects /
    onPlayEffects / passiveEffects`, OR
  - (b) opt out via a new `libraryExempt: true` flag on
    `TechnologyDef` so the library setup
    ([`src/game/library/setup.ts`](../src/game/library/setup.ts))
    skips them.
- The fixture deck under `tests/fixtures/deck/technologies.json`
  has at least one tech of each new effect kind so the test suite
  exercises every dispatcher branch.
- A new content-coverage test under
  `tests/data/library-content-coverage.test.ts` (already exists —
  add a case) asserts the live deck satisfies the (a)-or-(b) rule.
- New unit tests under `tests/tech/effects.test.ts` cover each new
  effect kind end-to-end (acquire, play, and passive paths).
- `npm test` + `npm run typecheck` + `npm run lint` all green.

## Files to touch

- `card-decks/<each>/technologies.json` — author effect arrays.
- `tests/fixtures/deck/technologies.json` — author one tech per new
  effect kind.
- [`src/game/events/effects.ts`](../src/game/events/effects.ts) —
  extend `EventEffect`.
- [`src/game/events/dispatcher.ts`](../src/game/events/dispatcher.ts)
  — handle each new kind.
- [`src/game/tech/effects.ts`](../src/game/tech/effects.ts) —
  extend `grantTechUnlocks` for `unlockCard`; aggregate
  `producePerRound` and `unitStatBump` in passive helpers.
- [`src/game/track/resolver.ts`](../src/game/track/resolver.ts)
  `computeStats` — layer `unitStatBump` passives.
- [`src/game/phases/others.ts`](../src/game/phases/others.ts)
  `runProduceForSeat` — sum `producePerRound` passives.
- [`src/data/schema.ts`](../src/data/schema.ts) — optionally add
  `libraryExempt?: boolean` to `TechnologyDef`.
- [`src/game/library/setup.ts`](../src/game/library/setup.ts)
  `buildLibrary` — skip exempt techs.
- New: `tests/tech/effects-new-kinds.test.ts`.

## Why this is worth doing

Without this, the science → buy → tech flow is mechanically empty
for ~half the deck. The library buy moves are well-shaped and
already route the tech to the right hand; the discount tableau
already updates. But the player's reward for *playing* the tech is
"I no longer hold this card and I unlock buildings / units listed
in the tech text." Authoring effects closes the loop and makes the
tech depth advertised in the README real.

## Related

- [008](issue-008-library-content-overshoots-target.md) (closed —
  superseded by deck swap; the deck still doesn't author tech
  effects)
- [017](issue-017-trackcards-no-modifier-cards.md) (sibling
  content gap — same "schema supports it, content doesn't fill
  it" pattern)
- [020](issue-020-events-library-tagging-coverage.md) (closed —
  events now fully tagged)
