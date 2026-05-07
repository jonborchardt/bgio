# Set 6 — Merged Best (3 + 4 + 5)

**Design goal:** the recommended deck. Combines the placement-bonus
synergy of Set 3, the color-balanced library of Set 4, and the
formula-derived costs of Set 5. **Skips Set 2** — keeps the current
mixed theme palette (no Iron-Frontier rename pass).

## Counts

| Deck | Current | This set | Δ |
|---|---|---|---|
| Buildings | 58 | 37 | −36% |
| Units | 76 | 50 | −34% |
| Technologies | 132 | 86 | −35% |
| Events | 16 | 24 | +50% |
| **Total** | **282** | **197** | **−30%** |

Lean enough that every card is distinct; not so small that the Library
row stops surprising you.

## What was kept from each donor set

### From Set 3 (placement-bonus synergy)

- **45 of 50 units carry a placement bonus.** Up from 2 of 76 in the current deck.
- All five `PlacementEffect` kinds (`strength` / `range` / `regen` / `hp` / `firstStrike`) are exercised across multiple units.
- Synergy archetypes preserved:
  - **Wall garrison polearms** (Spearman / Pikeman / Halberdier on Walls)
  - **Tower archery** (Archer / Marksman / Master Marksman / Sniper / Watchman → Tower)
  - **Smith-line bombers** (Sapper / Saboteur / Berserker / Cutter / Axeman on Forge / Smithy / Ironworks)
  - **Cavalry stables** (Light / Heavy / Lancer on Stables; Heavy chains to Drill Yard + Garrison)
  - **Cathedral / Garrison healing** (Paladin / Battle Medic / Witch Doctor / Field Doctor)
  - **Cellar ambush** (Smuggler / Knife Fighter / Saboteur)
  - **Civic spend sinks** (Forager, Miller, Potter, Treasurer, Trader, Scholar, Pioneer)

### From Set 4 (color-balanced techs)

Tech library distribution **22 / 22 / 21 / 21** across gold / blue / green / red — replaces the current **19 / 27 / 38 / 48** skew.

- Diplomatic / economic techs → gold (Treaties, Mercenaries, Tribute, Embassy, Treasury, Heraldry, Leadership, Holidays, Festivals, Philosophy, Political Theory).
- Theory / medical / observation techs → blue (Mathematics, Anatomy, Field Medicine, Triage, Engineering, Architecture, Bridges, Optics, Tactics, Discipline, Logistics, Maps, Cartography).
- Civic / build / craft → green (Farming, Cooking, Mining, Masonry, Plumbing, Smithing, Smelting, Glassblowing, Walls, etc.).
- Pure military / doctrine → red (Stick Fighting, Knives, Phalanx, Cavalry Doctrine, Plate Armor, Sharpshooting, Sniping, Siegecraft, Heavy Weapons).

This makes all four boss-debuff thresholds (5 / 10 / 15) reachable — gold and blue were effectively unreachable in the current deck.

### From Set 5 (formula-derived costs)

- **Buildings** priced by `BuildingCost = TierBase + Σ(stat × weight) + (maxHp − 1) × 2`. Every building's `note` field shows the decomposition.
- **Units** priced by `PowerLevel = attack + (hp − 1) × 0.6 + (range − 1) × 2 + regen × 2.5 + firstStrike × 2 + max(initiative − 4, 0) × 0.5`, with documented `+ utility_premium` for splash / focus / cavalry / boss / placement-bonus reasons.
- **Techs** follow the strict tier rule: T1 ≤ 1 cost-resource, T2 ≈ 2, T3 ≈ 3.

## What was *not* taken from Set 2

No theme rewrite. The deck keeps the current mixed palette:

- **Pre-modern core retained as-is** — Spearman, Halberdier, Lancer, Heavy Cavalry, War Elephant, Trebuchet, Catapult, Cathedral, Aqueduct, Fortress, etc.
- **Modern flavor surface trimmed but kept** — Sniper, Marksman, Heavy Howitzer, Combat Engineer, Field Doctor remain. The Auto / Truck / Drone / Solar / Power Grid subtree is dropped (it was theme drift *and* dead synergy weight, since none of those units had natural building-anchors), but the broader "post-collapse village" tonality survives via Howitzer / Sniper / Combat Engineer.

If you later want Iron-Frontier's full rename pass, that's a flavor patch over this set rather than a rebalance.

## Why this set is the recommendation

1. **Spatial play actually matters.** The defense seat's grid placement decision becomes "where does this unit *belong*?" instead of "where is there room?" That's the single biggest shift to playability.
2. **All four boss debuffs are reachable.** A science seat can chase any color path and have a real chance of hitting level 3. Today, gold-3 is effectively impossible.
3. **Costs are predictable.** Every cost has a one-line derivation in its `note`. New cards can be authored in 30 seconds with a calculator. Re-balancing is a one-knob change.
4. **Onboarding is faster.** 197 cards is readable in one sitting; 282 is not.
5. **No flavor risk.** Skipping Set 2 means tone stays where it is — no second debate about "are we Iron-Age or post-apocalyptic" while balance and synergy are being settled.

## Numbers worth checking before paper play

| Metric | Current | Set 6 | Notes |
|---|---|---|---|
| Units with placement bonuses | 2 / 76 (3%) | 45 / 50 (90%) | Set 3 import |
| Tech color spread (gold / blue / green / red) | 19 / 27 / 38 / 48 | 22 / 22 / 21 / 21 | Set 4 import |
| Library cards reaching color-3 (≥15) | green ✓ red ✓ — gold ✗ blue ✗ | all four reachable | Set 4 + events |
| Building cost monotonicity by tier | bumpy (5–18 in T1, 13–30 in T2 mixed) | strict (T1 ≤ 11, T2 17–24, T3 ≥ 26) | Set 5 import |
| Unit cost vs PowerLevel (R²) | ~0.6 hand-fit | ~0.95 formula | Set 5 import |

## Open follow-ups (V2)

- **Paper-play the formulas.** Set 5's coefficients (food=3, def=5, range×2, regen×2.5, firstStrike×2) are first guesses anchored on current medians. Expect 1–2 to need adjustment after 3–5 games.
- **Per-color → boss flavor mapping** (master plan open question #1) is still unresolved; this set just makes all four colors *reachable* — assigning each to a flavor of boss attack is a separate code change.
- **`trackCards.json` is untouched.** A future Set 7 could regenerate the threat curve by formula the same way.
- **Several civilian utility units** (Scholar, Trader, Treasurer, Potter) reference V1.5 mechanics (sci aura, gold-per-round) that aren't yet in the engine. Their placement bonuses fire today; the auras are future work.
