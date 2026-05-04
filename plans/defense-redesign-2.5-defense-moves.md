# Sub-phase 2.5 — Defense moves + bot enumerator

**Parent:** [phase-2](./defense-redesign-phase-2.md)
**Spec refs:** D11, D12, D13, D14, D23, D24 + §9 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 2.1 + 2.2 + 2.3 + 2.4 merged.

## Goal

Add the three defense moves — `defenseBuyAndPlace`, `defensePlay`
(red tech: unit upgrades and track manipulation), `defenseSeatDone`
— and a bot enumerator that produces sane plays during a network
run.

After 2.5, defense is a real, playable role.

## Files touched

- `src/game/roles/defense/buyAndPlace.ts` (new).
- `src/game/roles/defense/play.ts` (new) — applies a red tech
  effect.
- `src/game/roles/defense/seatDone.ts` — already exists from 1.4
  rename; no change.
- `src/game/roles/defense/types.ts` — already updated in 1.4 to
  hold the new `inPlay` shape; confirm fields.
- `src/game/roles/defense/ai.ts` (new) — `ai.enumerate` for
  defense.
- `src/game/phases/stages.ts` — register defense moves on the
  defense stage.
- `src/data/technologies.json` + loader — confirm red tech entries
  carry the new effect taxonomy (unit upgrade vs track modifier).
- `tests/game/roles/defense/buyAndPlace.spec.ts` (new).
- `tests/game/roles/defense/play.spec.ts` (new).
- `tests/game/roles/defense/ai.spec.ts` (new) — enumerator returns
  non-empty against a populated state.

## `defenseBuyAndPlace`

```ts
move({ G, ctx, playerID }, { unitDefID, cellKey }) {
  if (defenseSeat(G, ctx) !== playerID) return INVALID_MOVE;
  const handIndex = G.defense.hand.findIndex(u => u.name === unitDefID);
  if (handIndex < 0) return INVALID_MOVE;
  const def = G.defense.hand[handIndex];

  // Tile must be a placed (non-center) building owned by domestic.
  const cell = G.domestic.grid[cellKey];
  if (!cell || cell.isCenter) return INVALID_MOVE;

  const cost = unitCost(def);     // resource bag from def
  const stash = G.mats[playerID].stash;
  if (!canPay(stash, cost)) return INVALID_MOVE;

  payFromStash(stash, cost);

  // Append to inPlay. placementOrder = monotonic counter on G.
  G.defense.inPlay.push({
    id: `u-${G.defense._instanceCounter++}`,
    defID: def.name,
    cellKey,
    hp: def.hp,
    placementOrder: G._defensePlacementSeq++,
  });

  // Don't remove from hand — units are recruited from a card pool;
  // hand cycling rule depends on content. Default: leave in hand
  // (matches current foreign behavior).
}
```

(Implementation note: `_instanceCounter` and `_defensePlacementSeq`
are bookkeeping integers added to state for stable IDs. Existing
patterns in the codebase use similar counters.)

## `defensePlay`

Applies a red tech:

- **Unit-upgrade techs** target a unit instance and grant a
  durable `taughtSkill` (reusing the same effect taxonomy as
  science Teach in 2.6). The effect plumbing is shared.
- **Track-modifier techs** mutate `G.track.upcoming` per their
  effect:
  - **peek N**: surfaces info to the defense seat (no state
    change beyond a "peeked" flag for UI).
  - **swap within phase**: take the next card, return it to its
    phase pile, draw another from the same pile.
  - **demote**: replace the next card with a discarded card from
    the previous phase's pile. (Implementation note: track
    history holds previous-phase discards.)

```ts
move({ G, ctx, playerID }, { techDefID, args }) {
  if (defenseSeat(G, ctx) !== playerID) return INVALID_MOVE;
  const tech = G.defense.techHand?.find(t => t.name === techDefID);
  if (!tech) return INVALID_MOVE;
  const effect = tech.onPlayEffects;
  if (!effect) return INVALID_MOVE;
  // Cost: tech cards usually cost the science seat's contribution
  // already; defense plays them free of resource cost. (Confirm
  // against existing playTech.ts behavior from pre-1.4.)
  applyTechEffect(G, effect, args);
  // Remove from hand — single-use card.
  G.defense.techHand = G.defense.techHand!.filter(t => t.name !== techDefID);
}
```

## `defenseSeatDone`

Already exists post-1.4. Behavior unchanged. No upkeep gate.

## Bot enumerator

```ts
// src/game/roles/defense/ai.ts
export const enumerate: AIEnumerate<SettlementState> = (G, ctx, playerID) => {
  if (defenseSeat(G, ctx) !== playerID) return [];
  if (G.defense._stageDone?.[playerID]) return [];

  const moves: Array<{ move: string; args: unknown[] }> = [];

  // 1. End-my-turn always available.
  moves.push({ move: 'defenseSeatDone', args: [] });

  // 2. Buy + place. Score by "covers telegraphed next card's path."
  const next = peekNext(G.track);
  const nextPath =
    next && next.kind === 'threat'
      ? computePath(next.direction, next.offset, gridBounds(G))
      : [];
  for (const u of G.defense.hand) {
    if (!canPay(G.mats[playerID].stash, unitCost(u))) continue;
    for (const cellKey of Object.keys(G.domestic.grid)) {
      const cell = G.domestic.grid[cellKey];
      if (cell.isCenter) continue;
      // Score: prefer placements that cover next-path tiles.
      const covers = tileCoversPath(parseCell(cellKey), u.range, nextPath);
      if (covers || G.defense.inPlay.length === 0) {
        moves.push({
          move: 'defenseBuyAndPlace',
          args: [{ unitDefID: u.name, cellKey }],
        });
      }
    }
  }

  // 3. Tech plays. Trivial enumerator — defer scoring to MCTS.
  for (const t of G.defense.techHand ?? []) {
    moves.push({ move: 'defensePlay', args: [{ techDefID: t.name }] });
  }

  return moves;
};
```

The greedy "covers next-card path" heuristic gives the bot a
reasonable starting strategy. MCTS / a richer search would improve
it; not a 2.5 deliverable.

## Tests

- `defenseBuyAndPlace`:
  - succeeds when stash covers cost and tile is a non-center
    building.
  - fails on center tile, missing cost, missing building.
  - increments `placementOrder` so first-in-first-killed has a
    deterministic answer.
- `defensePlay`:
  - applies unit upgrade tech to the chosen unit.
  - applies track-modifier tech (e.g. swap) and resulting
    `upcoming` changes.
  - rejects when the named tech isn't in hand.
- `enumerate`:
  - returns at least `defenseSeatDone` from any state.
  - returns buy+place options when defense has cards and stash.
  - prefers placements covering the telegraphed path.
- A 4-bot game completes a chief flip → defense reacts → next
  round flip without errors. Assert defense made at least one
  buy+place across the run.

## Out of scope

- Drill / teach (2.6 — separate seat's moves).
- Boss interactions (2.7).
- Wander retirement (2.8).
- UI (Phase 3).

## Done when

- Defense moves dispatch from headless tests.
- Bot enumerator returns non-empty against typical mid-game state.
- A scripted 10-round run completes deterministically with both
  defense bot and chief flip wired together.
