# Issue 031 — RandomBot fuzz harness omits Defense recruits, Domestic upgrades, event plays

**Severity**: medium
**Area**: tests / fuzz / AI
**Effort**: medium
**Status**: not started

## Files
- `tests/fuzz/randomBot.test.ts:50-95`

## Problem
The stub `enumerate` lists `defenseSeatDone` only, never `defenseBuyAndPlace` /
`defensePlay`; never plays events; never repairs. Defense never fields units in
any fuzz run, so combat invariants never get tested by the fuzzer. The 2.x
defense redesign is not covered by the loose-conservation / no-negative-resources
fuzz.

## Fix sketch
Expand the fuzz harness's enumerate stub to include defense recruit + place,
domestic upgrades, and event plays. Add args helpers for buying buildings/units
(payload shape is non-trivial). Re-run the fuzz to confirm no regressions
introduced by the wider move space.

## Acceptance
- Fuzz harness exercises every move in the public `Settlement.moves` map at
  least once over a sample run.
- Resource-conservation invariants still hold across N=1000 trials.

## Related
- 037 (boss winRate test — same theme)
