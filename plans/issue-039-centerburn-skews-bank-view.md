# Issue 039 — `centerBurn` audit log skews `computeBankView` per-round split

**Severity**: medium
**Area**: game / engine
**Effort**: medium
**Status**: not started

## Files
- `src/game/track/centerBurn.ts:96-109` — emits `centerBurn` source via `appendBankLog`
- `src/game/resources/bankLog.ts:127-152` — `computeBankView` treats every log entry as bank flow

## Problem
`centerBurn` emits a negative delta through `appendBankLog`, but no bank tokens
actually moved. `computeBankView` then subtracts that "outflow" from the chief's
stash view per-round — so the chief's stash display is wrong by the burn amount.

## Fix sketch
Either:
- Tag the entry to be excluded from `computeBankView` (e.g. a `nonBankFlow: true`
  flag on the log entry), and skip it during the round-split aggregation.
- Or convert the audit event to a separate event type (`G.auditLog` vs
  `G.bankLog`).

Option A is smaller. Add a regression test in `tests/resources/bankLog.test.ts`.

## Acceptance
- Center burn does not affect `computeBankView`'s round-split.
- Test pins the behaviour.

## Related
- 030 (engine test gaps)
