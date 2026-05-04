# Sub-phase 2.6 — Science Drill + Teach

**Parent:** [phase-2](./defense-redesign-phase-2.md)
**Spec refs:** D27 + §8a in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 2.5 merged (defense units exist on the grid for
science to target).

## Goal

Add the two new science-seat moves: **Drill** (one-shot +1
strength on a unit's next fire) and **Teach** (durable skill
applied to a unit). Wire the resolver so taught skills and drill
markers feed into combat math correctly.

After 2.6, science has new active per-turn play tied to the
defense effort.

## Files touched

- `src/game/roles/science/drill.ts` (new) — `scienceDrill`.
- `src/game/roles/science/teach.ts` (new) — `scienceTeach`.
- `src/game/roles/science/skills.ts` — already created in 1.1;
  ensure `SKILLS` is exported and includes the V1 set.
- `src/game/roles/science/types.ts` — add per-round flag
  `scienceDrillUsed?: boolean` and `scienceTaughtUsed?: boolean`
  for the once-per-round caps.
- `src/game/roles/defense/types.ts` — `UnitInstance` already
  carries `drillToken?` and `taughtSkills?` from 1.4.
- `src/game/track/resolver.ts` — apply taught skills + drill at
  fire time.
- `src/game/hooks.ts` — round-end clears `drillToken` if
  unconsumed (+ clears `scienceDrillUsed`, `scienceTaughtUsed`).
- `src/game/phases/stages.ts` — register both moves on the science
  stage.
- `tests/game/roles/science/drill.spec.ts` (new).
- `tests/game/roles/science/teach.spec.ts` (new).
- `tests/game/track/resolver-skills.spec.ts` (new) — integration.

## Move specs

### `scienceDrill`

```ts
move({ G, ctx, playerID }, { unitID }) {
  if (scienceSeat(G, ctx) !== playerID) return INVALID_MOVE;
  if (G.science.scienceDrillUsed) return INVALID_MOVE;
  const cost = drillCost(G); // small, e.g. 1 science from stash
  const stash = G.mats[playerID].stash;
  if (!canPay(stash, { science: cost })) return INVALID_MOVE;
  const unit = G.defense.inPlay.find(u => u.id === unitID);
  if (!unit) return INVALID_MOVE;
  payFromStash(stash, { science: cost });
  unit.drillToken = true;
  G.science.scienceDrillUsed = true;
}
```

`drillCost(G)`: V1 ships at flat cost 1 science; can scale with
phase later. Document the tuning lever in the module header.

### `scienceTeach`

```ts
move({ G, ctx, playerID }, { unitID, skillID }) {
  if (scienceSeat(G, ctx) !== playerID) return INVALID_MOVE;
  if (G.science.scienceTaughtUsed) return INVALID_MOVE;
  const skill = SKILLS[skillID];
  if (!skill) return INVALID_MOVE;
  const cost = skill.cost; // from SKILLS table
  const stash = G.mats[playerID].stash;
  if (!canPay(stash, { science: cost })) return INVALID_MOVE;
  const unit = G.defense.inPlay.find(u => u.id === unitID);
  if (!unit) return INVALID_MOVE;
  // Idempotency: refuse to teach the same skill twice to one unit.
  unit.taughtSkills = unit.taughtSkills ?? [];
  if (unit.taughtSkills.includes(skillID)) return INVALID_MOVE;
  payFromStash(stash, { science: cost });
  unit.taughtSkills.push(skillID);
  G.science.scienceTaughtUsed = true;
}
```

## Resolver integration

The combat resolver in 2.3 reads a unit's effective stats at fire
time. Extend that path:

```ts
function effectiveStats(unit: UnitInstance, def: UnitDef, threat: ThreatCard, building: DomesticBuilding) {
  let strength = def.strength;
  let range = def.range;
  let firstStrike = def.firstStrike;
  let regen = def.regen;
  let hp = unit.hp;        // not modifying; just for clarity
  let maxHp = def.hp;

  // Apply placementBonus from def (D18) if building matches.
  for (const pb of def.placementBonus ?? []) {
    if (pb.buildingDefID !== building.defID) continue;
    applyEffect(pb.effect);
  }

  // Apply taught skills (D27).
  for (const skillID of unit.taughtSkills ?? []) {
    applyEffect(SKILLS[skillID].effect);
  }

  // Apply matchup text (D10) — printed bonuses against threat.modifiers.
  for (const m of def.matchupBonuses ?? []) {
    if (threat.modifiers?.includes(m.tag)) strength += m.amount;
  }

  // Apply drill marker (D27).
  if (unit.drillToken) strength += 1;

  return { strength, range, firstStrike, regen, hp, maxHp };
}
```

Order matters in only one place: drill is *always* additive after
all other modifiers (it's a one-shot +1 regardless of source).
Document this in the resolver header.

After firing:

- If `unit.drillToken` was true, set it to `false`. Spec says
  "consumed at fire time."
- The skills stay on the unit instance.

## Round-end

```ts
// hooks.ts
registerRoundEndHook((G) => {
  G.science.scienceDrillUsed = false;
  G.science.scienceTaughtUsed = false;
  // Drill markers persist across rounds if the unit didn't fire.
  // Spec is silent on this — recommend "persist until consumed,
  // OR until the unit dies." Implement persist-until-consumed.
});
```

If you'd rather drill markers expire each round, that's a small
flag flip. Recommend persist-until-consumed: fits the "schooling
the unit for the next big fight" theme.

## Tests

- `scienceDrill`:
  - successful application sets `unit.drillToken = true`.
  - costs 1 science from stash.
  - rejects if used already this round.
  - rejects if the unit ID doesn't exist.
- `scienceTeach`:
  - successful application appends to `unit.taughtSkills`.
  - rejects on duplicate skill on same unit.
  - rejects if used already this round.
- Resolver integration:
  - A drilled unit deals +1 strength on its next fire; the marker
    is then cleared.
  - A unit with `taughtSkills: ['extendRange']` covers a path one
    Chebyshev step further than its base range.
  - Drill stacks with placementBonus and matchup bonuses
    additively.
- Round-end:
  - `scienceDrillUsed` and `scienceTaughtUsed` reset each round.
  - Drill marker persists across rounds if not fired.

## Out of scope

- Boss thresholds (2.7).
- Tech-card distribution (already handled by science complete).
- UI (Phase 3 — drill/teach indicators).

## Done when

- Both moves dispatch from headless tests and apply correctly.
- Resolver tests confirm drill / teach affect combat math.
- A 4-bot game where science occasionally drills / teaches
  completes deterministically.
