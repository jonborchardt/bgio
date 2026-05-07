# Set 2 — Iron Frontier

**Design goal:** strip the post-apocalyptic / modern theme drift. Every card
fits a coherent **late-Iron-Age frontier village**: bow, spear, axe, plate,
horse, catapult. Trucks, drones, rifles, solar panels, and electric grids
are gone.

## Counts (deck → diff vs current)

| Deck | Current | This set | Δ |
|---|---|---|---|
| Buildings | 58 | 58 | 0 |
| Units | 76 | 73 | −4% |
| Technologies | 132 | 102 | −23% |
| Events | 16 | 16 | 0 |

Counts stay near parity — the goal is **flavor coherence**, not size.

## What got renamed / replaced

### Modern → period-appropriate

| Removed (modern) | Replaced with (Iron-Age) |
|---|---|
| Truck Rammer / Truck Gunner / Jeep Archer / Humve Gunner / Car Gunner / Car Tank / Advanced Car Tank | Scythed Chariot / Heavy Chariot / Chariot Archer |
| Recon Drone / Drone Swarm | Falconer / Hawking Sky |
| Marksman / Designated Marksman / Long Gunner / Sniper / Camo Sniper / Small Gunner / Rifle Squad / MG Nest / Machine Gunner / Machine Gunner Team / Big Gunner | Longbowman / Master Archer / Composite Bow / Volley Squad / Long Bowmen Line / Master Marksman / Camo Sharpshooter / Crossbow Battery |
| Bomber / Granader / Flame Trooper / Battle Mage | Naphtha Crew / Grenadier (gunpowder T3) / Flame Cohort / Pyromancer |
| Trebuchet (T2) / Mortar Team / Bazooka / Heavy Howitzer | Onager Crew (T2) / Catapult Crew / Trebuchet Crew / Greater Trebuchet / Naphtha Battery / Ironbound Ram |
| Mechanic / Field Engineer / Saboteur (kept) | Pioneer Sergeant / Combat Engineer / Sapper |
| Solar Array / Power Plant / Generator Shed | Watermill / Wonder of Bronze / Foundry |
| Recycling Yard | Charcoal Burner / Tannery |
| Print Shop (kept by name) | renamed Scriptorium (more period-faithful) |

### Tech subtrees — gone

- **Auto subtree** (Hotwire car, Driving, Auto Doctrine, Combined Arms, Fix car, Heavy Auto Doctrine) → removed wholesale.
- **Electronics / electric grid** (Fix electronics, Drone Tactics, Generators, Electricity, Power Grid, Solar panels, Factory working, Refrigeration) → removed wholesale.
- **Firearms tree** (Small guns, Big guns, Riflery, Sniping, Bullet manufacturing, Cover Fire on rifles) → repurposed under **Archery / Sharpshooting / Cover Fire / Siegecraft**, all of which fit a longbow / crossbow / catapult line.

### Tech subtrees — added or reframed

- **Falconry** (T2) — new, gates Falconer + Hawking Sky.
- **Greek Fire** (T3, requires Demolitions + Herb Lore) — pre-gunpowder analog of explosives; fuels Naphtha Crew, Naphtha Battery, Pyromancer, Flame Cohort.
- **Gunpowder** (T3, requires Greek Fire + Demolitions) — terminal node; gates Grenadier only. Frontier-faithful: gunpowder *exists* but it's the cutting edge, not the assumed default.
- **Siegecraft** (T3, requires Engineering) — central hub for all the heavy ranged units (catapult, ballista, trebuchet, ram).
- **Bridges** (T3) — required for Aqueduct + Watermill (the period uses water, not steam).
- **Heraldry** (T2) — gates Standard Bearer (was tagged "Tactics" before; the new branch is more period-flavored and creates a non-attack way to spend science).
- **Master Crafts** (T3) — gates Wonder of Bronze.

## Why this set is better

1. **Tonal coherence makes copy easier to write.** Every card now reads like it belongs in the same world. No more `Stick Fighting → Spearman` next to `Hotwire car → Truck Rammer`. New content authored against this set has a clear voice.
2. **Concept-painting is sharper.** When the AI / illustrator / table-mat designer asks "what does this look like?" the answer is now consistent (palette, silhouette, materials).
3. **Tabletop-playable rule is easier to honor.** The Iron-Age vocabulary maps onto common token sets (cubes for resources, wooden meeples for soldiers, coins for gold) without the weird translation gap of "this is a drone" / "this is a humvee gunner."
4. **Mechanics preserved.** Card stats / requirements / unlocks are mostly identical to the current deck — this is a flavor pass, not a balance pass. Anyone who knows the old `Drone Swarm` math knows the new `Hawking Sky` math.
5. **Tech tree shrinks naturally** (132 → 102) without losing depth — the auto / electric subtrees were 25+ cards of post-apoc filler that this set replaces with a tighter set of period-appropriate alternatives.

## Open follow-ups (V2)

- A second pass could re-balance: e.g. **Greek Fire** as a new T3 hub probably wants splash damage to scale with Tier rather than be a flat number.
- The **Wonder of Bronze** card is unique — single-card subtype. It's intentionally a one-off "monument" mechanic; if we like it, we could expand into a Wonders subdeck.
- The schema still won't let buildings be tagged anything but green (or they wouldn't go to domestic). This set leaves the color tagging unchanged; Set 4 attacks that separately.
- Track cards (`trackCards.json`) are untouched. Several still reference modern threats (`Wyvern`, `Ironclad Phalanx`, `Fire Engines`) — those happen to fit the Iron-Age palette already, so no change needed; but a follow-up could rename `Catapult Battery` → `Trebuchet Line` to match the new vocabulary.
