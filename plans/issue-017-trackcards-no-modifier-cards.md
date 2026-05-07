# Issue 017 — `trackCards.json` ships zero `modifier` cards despite Rules.md describing the trio

**Severity**: medium
**Area**: data / content
**Effort**: small
**Status**: not started

## Files
- `src/data/trackCards.json` — 13 boons + 20 threats + 1 boss = 34 cards, **no modifiers**
- `src/data/schema.ts` — schema fully supports `kind: 'modifier'`
- `src/game/track/resolver.ts` — handles modifiers in dispatch
- `src/game/phases/endOfRound.ts` — clears `track.activeModifiers` even though no card pushes onto it
- `docs/Rules.md` §4, §5.3 — describes threats / boons / modifiers trio
- `docs/game-design.md` — same

## Problem
Rules.md and game-design.md describe a threats/boons/modifiers trio. Schema and
resolver fully support modifiers, but no content card has `kind: 'modifier'`.
Either content is missing or docs over-promised.

## Fix sketch
Add 2-3 modifier cards in mid-track phases (e.g. "next threat strength +1",
"chief gains +1 stipend for one round"). Use the existing schema. Alternatively,
trim modifier discussion from Rules.md / game-design.md until content lands.

## Acceptance
- `trackCards.json` has at least 3 modifier cards distributed across mid phases.
- `track.activeModifiers` is non-empty after at least one track flip in a fresh
  game.
- A test in `tests/game/track/` covers modifier dispatch end-to-end.

## Related
- 008 (broader content rebalance)
