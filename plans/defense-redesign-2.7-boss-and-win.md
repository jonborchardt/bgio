# Sub-phase 2.7 — Boss resolution + win condition

**Parent:** [phase-2](./defense-redesign-phase-2.md)
**Spec refs:** D21, D25 + §5 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 2.1 + 2.2 + 2.3 + 2.5 + 2.6 merged.

## Goal

Implement the boss card: three thresholds (Science, Economy,
Military), an attack pattern that runs in a single round, and the
win condition flip. After 2.7, a 4-bot game can reach the boss,
resolve it, and win or time-out.

## Files touched

- `src/game/track/boss.ts` (new) — `resolveBoss(G, random, card)`.
- `src/game/track/resolver.ts` — replace the boss stub from 2.3
  with a real call.
- `src/game/endConditions.ts` — already gated on
  `G.bossResolved` from 1.5; ensure `resolveBoss` flips it to
  `true`.
- `src/game/types.ts` — confirm `bossResolved` is on
  `SettlementState`.
- `tests/game/track/boss.spec.ts` (new) — coverage.
- `tests/game/endConditions.spec.ts` — extend with boss-win path.

## Boss card structure (recap from 2.1)

```ts
interface BossCard extends TrackCardBase {
  kind: 'boss';
  thresholds: { science: number; economy: number; military: number };
  baseAttacks: number;     // attacks if NO thresholds met
  attackPattern: ThreatPattern[]; // sequence of strengths/dirs/offsets
}

interface ThreatPattern {
  direction: Direction;
  offset: number;
  strength: number;
  modifiers?: string[];
}
```

The attack pattern is a *fixed sequence* on the card — no
randomness. The number of attacks made is
`baseAttacks - thresholdsMet` (clamped at 0). If no attacks happen
(all 3 thresholds met and `baseAttacks <= 3`), the boss is
trivially defeated.

## `resolveBoss`

```ts
export const resolveBoss = (
  G: SettlementState,
  random: RandomAPI,
  card: BossCard,
): void => {
  // 1. Compute thresholds met.
  const sciCount = countCompletedScience(G);
  const econ = G.bank.gold ?? 0;
  const mil = sumUnitStrength(G);

  let met = 0;
  if (sciCount >= card.thresholds.science) met++;
  if (econ >= card.thresholds.economy) met++;
  if (mil >= card.thresholds.military) met++;

  const attacks = Math.max(0, card.baseAttacks - met);

  // 2. Run attacks in sequence. Each is a synthetic ThreatCard
  //    pushed through the existing resolver.
  for (let i = 0; i < attacks; i++) {
    const pattern = card.attackPattern[i % card.attackPattern.length];
    const synthetic: ThreatCard = {
      id: `boss-attack-${i}`,
      name: `${card.name} (attack ${i + 1})`,
      phase: 10,
      description: card.description,
      kind: 'threat',
      direction: pattern.direction,
      offset: pattern.offset,
      strength: pattern.strength,
      modifiers: pattern.modifiers,
    };
    resolveThreat(G, random, synthetic);
  }

  // 3. After all boss attacks, the village won.
  G.bossResolved = true;
};
```

A few things to note:

- The boss runs all its attacks **in the same round** as the flip.
  Spec D21 confirms this. Defense had its prep round earlier.
- Each attack uses the exact same `resolveThreat` pipeline as a
  normal threat — same range / first-strike / damage absorption /
  center-burn rules. Code reuse is total.
- `bossResolved = true` is the single state flip the win check
  watches. `endConditions.ts` from 1.5 fires `{ won: true }` on
  the next `endIf` evaluation.
- If the village's last building is razed during the boss's last
  attack, the village still wins — no fail mode (D26). Track and
  state remain consistent for the score recording in `onEnd`.

## Helpers

```ts
const countCompletedScience = (G: SettlementState): number => {
  // walk G.science.grid; count cards in `completed` state.
  let n = 0;
  for (const card of Object.values(G.science.grid)) {
    if (card.completed) n++;
  }
  return n;
};

const sumUnitStrength = (G: SettlementState): number => {
  let total = 0;
  for (const u of G.defense.inPlay) {
    const def = UNITS.find(d => d.name === u.defID);
    if (def) total += def.strength;
  }
  return total;
};
```

(`G.science.grid` shape comes from current science state — confirm
field name during 2.7. `G.bank.gold` is the existing chief-bank
slot.)

## Tests

- All thresholds met: `attacks = max(0, baseAttacks - 3)`. With
  `baseAttacks: 4`, attacks = 1.
- No thresholds met: `attacks = baseAttacks`. With `baseAttacks: 4`,
  attacks = 4.
- Attack pattern shorter than `attacks`: cycles through the
  pattern modulo length.
- After resolveBoss: `G.bossResolved === true`.
- Win path: `endIf` returns `{ won: true }` after the boss flip.
- Determinism: identical seed produces identical boss outcome.
- Edge case: village has 0 buildings (impossible normally, but
  test); attacks land on center burns only.

## Score recording

Update `onEnd` in `endConditions.ts` to record:

```ts
{
  outcome: G.bossResolved ? 'win' : 'timeUp',
  rounds: G.round,
  buildingsAtEnd: countBuildings(G),
  hpRetained: averageHpPct(G),
  unitsAlive: G.defense.inPlay.length,
}
```

This is content for the future replay / lobby summary; tests just
assert the shape and that values are reasonable.

## Out of scope

- Wander deck retirement (2.8 — folded into the track when the
  track was content-populated; 2.8 just removes the now-redundant
  wander code path).
- UI for the boss card (Phase 3 — boss readout panel).
- Balance of boss thresholds (later content tuning).

## Done when

- `resolveBoss` is dispatched from `chiefFlipTrack` when the
  boss card is the next card.
- A scripted full-track run (e.g. 30 forced flips) with the bots
  active reaches the boss and either wins or times out.
- `endIf` returns `{ won: true }` after a successful boss
  resolution.
- Tests cover all threshold combinations and pattern cycling.
