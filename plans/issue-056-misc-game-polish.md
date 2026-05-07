# Issue 056 — Miscellaneous game / engine polish (bundled)

**Severity**: low
**Area**: game / engine
**Effort**: small (each item)
**Status**: not started

This issue bundles small polish items individually too small to track separately.
Tackle as a single PR or split off as needed.

## Items

### a. `chiefDistribute` accepts absurd-magnitude signed integers
- File: `src/game/roles/chief/distribute.ts:50-56`
- Add a sanity bound (e.g. `|amount| <= 1000`) to reject obvious garbage.

### b. `__devGrantAllRoles` mutates state without `clearUndoable`
- File: `src/game/moves.ts:174-203`
- Either gate dev moves out of `_lastAction.state` capture or call
  `clearUndoable(G)`.

### c. `setActivePlayers` in `chiefPhase` activates seats with no role
- File: `src/game/phases/chief.ts:76-80`
- Skip `roles.length === 0` seats to mirror `activePlayersForOthers` STAGES.done
  fallback.

### d. `EffectiveStats.hp` is dead
- File: `src/game/track/resolver.ts:128-138`
- Either drop the field + the `'hp'` case in `applyPlacementEffect` or actually
  fold instance HP through it.

### e. Drill token comment misleading
- File: `src/game/track/resolver.ts:327-336`
- Comment says drill consumes regardless of hit; code actually only consumes on
  fire. Clarify the comment.

### f. `centerBurn` rounding floors silently on non-integer requested amounts
- File: `src/game/track/centerBurn.ts:77-94`
- Assert integer or `Math.ceil` to match the resource-rounding convention used
  in `produce.ts:57`.

### g. `seatOfRole` throws when phase config calls it
- Files: `src/game/roles.ts:58-75`; `src/game/phases/others.ts:59`,
  `src/game/track/centerBurn.ts:60`
- Wrap with `trySeatOfRole` (already used in `playerView`) so a custom test
  fixture without a chief seat doesn't crash phase config.

### h. `ROW_SIZE = 6` not exported from `src/game/library/setup.ts:22`
- Export the constant so refill.ts and tests don't hardcode `6`.

### i. `CHIEF_STIPEND_DEFAULT` not exported from the package barrel
- Files: `src/game/setup.ts:69`, `src/game/index.ts`
- Re-export so lobby UIs that surface this in a setup form use a single source.

### j. Inconsistent gating: chief moves gate on `phase`, others on `activePlayers[stage]`
- Add helper functions `isChiefActing(ctx, playerID)` and
  `isInRoleStage(ctx, playerID, stage)` to centralize the asymmetry.

### k. `hands: Record<PlayerID, unknown>` is too loose
- Files: `src/game/types.ts:123`, `src/game/playerView.ts:40-65`
- With Domestic / Defense state hoisted to `G.domestic` / `G.defense`, `G.hands`
  may be vestigial. Either type concretely or remove.

## Acceptance
- Each item either fixed or moved to its own issue with rationale.

## Related
- 013, 014 (cleanup theme)
- 042 (random fallback — also engine polish)
