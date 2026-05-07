we are skipping 008 till later: 

# Issue 008 — Library content over-shoots and is wildly skewed (282 vs 60 target)

**Severity**: high
**Area**: data / content
**Effort**: large
**Status**: not started

## Files
- `src/data/buildings.json` (58 tagged)
- `src/data/units.json` (76 tagged)
- `src/data/technologies.json` (132 tagged)
- `src/data/events.json` (4 of 16 tagged)
- `docs/game-design.md` §6 — names target `5×4×3 = 60 cards`

## Problem
Total tagged content = **282** vs the 60-card target. Distribution is wildly
skewed: green-T2/T3 = 26 each (target 5), red-T2 = 32, blue-T2 = 15, red-T3 = 27.
Only gold-T2 and gold-T3 (5 each) hit the target. Boss-debuff thresholds at
5 / 10 / 15 cards-per-color trigger far too easily, distorting the 5.2.1.5 rule
and making the boss too easy.

## Fix sketch
Run a content rebalance to converge on the 60-card target with even distribution
across (color × tier). The `card-decks/04-color-balanced/` snapshot looks like a
direct candidate replacement (issue 046 — decide whether to track it). Pair the
content trim with a regression test that asserts each (color, tier) bucket size
stays within ±1 of the target.

## Acceptance
- Library deck has ~60 cards across (5 colors × 4 tiers? or 4 colors × 3 tiers?
  reconcile the design doc's "5×4×3" with the actual color/tier dimensions).
- New test in `tests/game/library/` asserts bucket-size invariants.
- `boss-debuff.test.ts` (or similar) confirms thresholds are reachable but not
  trivially.

## Related
- 014 (BossThresholds 3-vs-2-field doc drift)
- 020 (events.json tagging coverage — same trim pass)
- 046 (`card-decks/` snapshot status)
