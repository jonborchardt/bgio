we are skipping 019 till later: 

# Issue 019 — Only 3 of 132 techs have `onPlayEffects`; 0 carry passive/onAcquire effects

**Severity**: medium
**Area**: data / content
**Effort**: large
**Status**: not started

## Files
- `src/data/technologies.json`
- `src/data/schema.ts:230+` — defines the typed effect surface

## Problem
The schema describes a rich typed-effect surface, but tech content is virtually
all free-text. The dispatcher will reject `<role>PlayTech` for ~129 techs.
Library-bought techs handed to non-science roles will sit idle, undermining the
whole library buy-and-play loop.

## Fix sketch
Either:
- (a) Content pass to author at least one `onPlayEffects` entry per tech, OR
- (b) Document explicit "stub-only V1" status in `docs/game-design.md` §8 and
  reduce the tech count drastically (paired with issue 008's content rebalance).

(b) is much smaller scope and probably the right V1 call. (a) becomes a content
backlog tracked separately.

## Acceptance
- Either: every tech in `technologies.json` has at least one effect.
- Or: a documented set of "V1 supported techs" is enumerated, untagged techs are
  removed from the library deck, and a test asserts every library card has at
  least one effect.

## Related
- 008 (content rebalance)
- 020 (events.json tagging coverage — same theme)
