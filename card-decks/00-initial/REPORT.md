# Set 0 — Initial (baseline snapshot)

Snapshot of the live deck files from `src/data/` at the time the rewrite
proposals (Sets 1 – 6) were authored. **Not a proposal** — kept here as the
"before" reference each REPORT.md compares against, so a reviewer can diff
any proposal directly against the deck it's replacing.

## Counts

| Deck | Count |
|---|---|
| Buildings | 58 |
| Units | 76 |
| Technologies | 132 |
| Events | 16 |
| **Total** | **282** |

## Known issues (the things the proposals try to address)

- **Color skew.** All buildings tagged `green`, all units tagged `red`. Techs split 19 gold / 27 blue / 38 green / 48 red — gold and blue together can't reach the level-3 boss debuff threshold (15 cards) in a typical match.
- **Placement bonuses unused.** Schema supports them; only 2 of 76 units have any (`Watchman→Tower range+1`, `Sapper→Forge strength+1`). The other 74 ignore the spatial axis.
- **Cost curve is hand-tuned.** No formula. Examples: `Cellar` (5g, 1 food) is cheaper than `Granary` (8g, 2 food) but Granary's benefit is more than 2× the value, so the markup sign is wrong. `Smokehouse` (10g) costs more than `Hunter's Lodge` (13g) for less benefit. T2 building costs span 13–24g without a clear monotonic curve.
- **Stat columns under-used.** All 76 units have `range: 1`, `regen: 0`, `firstStrike: false` (with 8 exceptions). The schema fields exist; the deck doesn't exercise them.
- **Theme drift.** Iron-Age cards (Spearman, Watchtower, Granary) sit next to post-apoc cards (Truck Rammer, Drone Swarm, Solar Array, Hotwire car). Tonal mash.
- **Near-duplicate units.** Three sniper lines, three rifle lines, four medic lines — ~25 distinct identities padded out to 76 cards.

## How to read this folder

Same four JSON files that load via `src/data/*.ts`. Identical schemas to
every other set under `card-decks/`. To diff any proposal against the
baseline: `diff card-decks/00-initial/units.json card-decks/<N>-<name>/units.json`.
