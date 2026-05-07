# Set 1 — Lean & Mean

**Design goal:** every card has a distinct identity. Cut redundancy hard;
keep the cards that pull weight; expand events (which were
underbuilt) so each role has variety.

## Counts (deck → diff vs current)

| Deck | Current | This set | Δ |
|---|---|---|---|
| Buildings | 58 | 30 | −48% |
| Units | 76 | 32 | −58% |
| Technologies | 132 | 70 | −47% |
| Events | 16 | 24 | +50% |
| **Total cards** | **282** | **156** | **−45%** |

## What got cut and why

### Buildings — culled near-duplicates
- Removed: `Cellar` (subset of `Granary`), `Hospital` / `Hospital Annex` (one survives), `Solar Array` / `Power Plant` / `Generator Shed` (post-apoc theme drift, dropped wholesale), `Recycling Yard`, `Fight Circle` (overlap with `Tavern`), `Glassworks` (too narrow), `Public Bath` (redundant with `Aqueduct`), `Engineering Guild` / `Engineering College` (only one survives — `School`), `Master Smith` (overlap with `Forge`+`Armory`), `Drill Yard` / `Theater` / `Grand Theater` / `Grand Bazaar` / `Brewery` / `Looms` / `Smithy` / `Trade Caravan` / `Customs House` / `Temple` / `Windmill` / `Bank` / `Arsenal` / `Factory`.
- Kept: Iron-Age core. Each of the 30 has a unique signature: `Granary`/`Smokehouse`=food, `Mill`=food+prod, `Trading Post`/`Market`/`Mint`/`Counting House`=gold ladder, `Library`/`Print Shop`/`School`=science ladder, `Walls`/`Tower`/`Fortress`/`Citadel`=defense ladder, `Forge`/`Ironworks`/`Armory`=offense ladder.
- Re-tuned costs along a gentler curve (T1 5–10g, T2 12–20g, T3 22–50g) — old curve was bumpy (8 → 5 → 10 → 6 → 13 → 13 → 13 → ...).

### Units — culled "same-but-different" lines
The current deck has three sniper lines (`Marksman` / `Designated Marksman` / `Long Gunner` / `Camo Sniper` / `Sniper`), three rifle lines (`Small Gunner` / `Rifle Squad` / `MG Nest` / `Machine Gunner` / `Machine Gunner Team` / `Big Gunner`), three Medic lines (`Medic` / `Battle Medic` / `Field Doctor` / `Witch Doctor`), three vehicle lines, etc. — 76 cards with maybe 25 distinct identities.
- Kept 32 cards, one canonical card per role (e.g. one sniper, one heavy ranged, one medic).
- Bumped `range` past 1 for actual ranged units (Archer 2, Hunter 3, Marksman 4, Sniper 5, Mortar 3, Howitzer 4, Trebuchet 4) — the current deck has 76 units all at `range: 1` which makes the ranged-vs-melee distinction printed in `note` fields meaningless.
- Added `regen` >0 to a few healers/tanks (`Shield Bearer` 1, `Battle Medic` 2, `Witch Doctor` 1, `Paladin` 1, `Army` 1) — currently used by zero units.

### Technologies — collapsed branches
- Current: 132 techs in 4 branches with a lot of "+ then + then +" ladder-padding (`Loot store` → `Packing` → `Loot house` → `Loot car` → `Loot corpse` …). This set keeps the branch shape but cuts to ~17 per branch.
- Removed: most `Loot *` techs (consolidated into `Bartering` + `Foraging`); the Auto / Truck / Hotwire / Drone / Solar / Generators / Electricity / Power Grid sub-tree (post-industrial theme drift); `Anti-Boss Doctrine` kept (it's load-bearing for the Heavy Howitzer); duplicate `Chemistry` / `Chemistry II` collapsed.
- Renamed `Mathematics` (was both `Math` and `Mathematics`); `Smithing` replaces `Blacksmithing` + `metalworking`.

### Events — went up, not down
The current event deck is the weakest part of the pile: 16 cards, four per
color, every one a flat resource gain (`{ science: 1 }`, `{ science: 2 }`,
…). This set ships 24 events (6 per color) including mixed bags (`Captured
Arms` = 1 steel + 1 gold; `Festival` = 1 happiness + 1 food) so each color
has one mono-resource ladder *and* two thematic mixed gains.

## Why this set is better

1. **Onboarding.** A new player can read the whole hand on day one — 30 buildings is a deck you can actually internalize, 58 isn't.
2. **Library rows feel different.** With near-duplicates gone, the 6-slot Library row (Set 1 has 30+32+70+24=156 buyable cards across 4 colors) gives you a meaningful choice every refill. The current deck often offers two-rifles-and-a-near-rifle.
3. **Range/regen are real now.** The `range`/`regen` columns in `units.json` exist in the schema but were authored as 1/0 across the entire current deck. This set actually uses them, so spatial play (placing the long-range unit further from center, the regen tank up front) becomes a decision.
4. **Cost curve is monotonic.** Building costs walk T1=5–10, T2=12–20, T3=22–50 with no inversions; unit costs walk T1=2–4, T2=5–9, T3=11–26. The current deck has e.g. `Smokehouse` (10) cheaper than `Cellar`'s upgrade `Granary` (8), and `Sniper` (17) costing the same as `Rifle Squad` (12) for very different stats.
5. **Library debuffs become reachable for gold.** Old gold-tagged Library count = 19 (only just enough to hit the 15 threshold and never any slack); this set has gold = 11 techs + 6 gold events + 1 building = 18 buyable, all of which gold-route to the chief, plus several blue/green techs that grant gold income — still tight, but explicitly authored, not accidental.

## Open follow-ups (V2)

- We still have **0 buildings tagged blue or red** and **0 units tagged blue or green**. Set 4 (`04-color-balanced`) addresses that explicitly; this set does not, because routing-by-color (`scienceLibraryBuy`) means tagging a building red would push it into the defense seat's hand where there's no place-building move.
- No placement bonuses on the new buildings (only on the units). Set 3 (`03-synergy-engine`) addresses that.
- This set deliberately does **not** rebalance `trackCards.json` — the pressure curve of the global event track is its own design surface; touching it on the same change is risky for paper-play.
