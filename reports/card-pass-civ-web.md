# Card Pass Report — Civ-style Web of Dependencies

## What changed and where

- **[src/data/buildings.json](../src/data/buildings.json)** — 35 → 58 entries. Existing buildings retained by name; most non-test-locked ones gained a mixed `costBag` (gold + wood / stone / steel / horse / food / production / science) and a prereq line in `note` ("Requires <tech> + <tech>."). 23 new buildings added to fill obvious slots in the tech tree.
- **[src/data/units.json](../src/data/units.json)** — 32 → 67 entries. Existing units kept their stats; `requires` now lists the actual tech (and sometimes building) chain, not just `"Auto"`. 35 new units added so each fighting tech has a payoff.
- **[src/data/technologies.json](../src/data/technologies.json)** — 66 → 82 entries. Every tech now has a populated `order` (prereq tech names), `cost` (text) + machine-readable `costBag`, `buildings` (what it unlocks), `units` (what it unlocks), and per-color flavor text on `blueEvent`/`greenEvent`/`redEvent`/`goldEvent`. A handful carry runtime `onAcquireEffects` / `onPlayEffects` that map to existing `EventEffect` kinds (`gainResource`, `redrawBattleTop`, `tributeWaiver`).

No engine code changed. The **rules of the game** are the same; what changed is the **content** the rules consume.

## Constraints respected

- **Engine fields untouched.** `BuildingDef.cost` is still the gold-equivalent heuristic the AI uses; tested costs (Granary 10, Mill 13, Factory 60) stay gold-only so [tests/roles/domestic/buy.test.ts](../tests/roles/domestic/buy.test.ts) and [tests/roles/domestic/upgrade.test.ts](../tests/roles/domestic/upgrade.test.ts) continue to pass exact bank balances.
- **`UnitDef.cost` stays gold-only** because [src/game/roles/foreign/recruit.ts](../src/game/roles/foreign/recruit.ts) charges `def.cost * count` gold; mixed-resource recruiting is a future engine change, not a content one.
- **`happiness` is not in any costBag** — happiness is an effect, not a resource that lands in stash, so requiring it would make a building unbuyable.
- **No invented effect kinds.** Tech `onPlay` / `onAcquire` only use kinds in [src/game/events/effects.ts](../src/game/events/effects.ts) — anything else throws at dispatch via the test in [tests/tech/effects.test.ts](../tests/tech/effects.test.ts).
- **Adjacency rules stay valid.** Every name referenced from [src/data/adjacency.json](../src/data/adjacency.json) (Mill, Granary, Hospital, Windmill, Workshop, Forge, Factory, Library, School, Market, Mint, Bank, Fight Circle, Barracks) still exists.
- **Verification:** `npm run typecheck` clean, `npm run lint` clean, `npx vitest run` 497 passed (86 files, 58 todo).

## The four trees, at a glance

The four science colors map to the four roles. A tech finished by the Science seat goes to that role's hand:

| Color | Role | Branch (in techs.json) | Theme |
|---|---|---|---|
| Blue | Science | Education | Pure research, theory, materials |
| Green | Domestic | Civic | Buildings, food, infrastructure |
| Red | Foreign | Fighting | Doctrines, weapons, units |
| Gold | Chief | Exploration | Trade, scouting, leadership |

This was already the structure; the new content makes the **why** legible: Education techs unlock the Science-side buildings (Library, School, Engineering College) and the Materials buildings (Glassworks, Pottery), Fighting techs unlock the Foreign units, Civic techs unlock the Domestic infrastructure, and Exploration techs unlock the trade/intel chain that the Chief most directly benefits from.

## How the web works (representative chains)

### 1. The food chain — a Domestic player's first three rounds

```
Camping (free)  ─┐
                 ├──▶ Farming ──▶ Granary (food)
horticulture ────┘         │
                           ├──▶ Mill   (food + production)
mill ──────────────────────┘
                           └──▶ bee keeping ──▶ Apiary
Pantry ──▶ Cellar
Cooking ──▶ Smokehouse, Tavern, Brewery
```

The **Granary** says `Requires Farming`. The **Mill** says `Requires mill + Farming`. **Smokehouse** says `Requires Cooking`. So a Domestic player who's been distributed `Farming` and `mill` can plan to buy Granary, then a Mill adjacent to it (the existing adjacency rule fires +1 food), then move on to Cooking-line buildings later. The starter resources (1 wood, 1 stone, 1 steel) plus Chief's gold get them through the first build cleanly: Granary is `{gold: 10}`, Mill is `{gold: 13}`, Smokehouse is `{gold: 5, wood: 3}` — all hittable in ~2 chief distributions.

### 2. The military chain — what Foreign actually researches

```
Stick fighting (free) ──▶ Spearman, Stick Fighter, Shield Bearer
                      └─▶ Tactics ──▶ Drill Yard, Standard Bearer, Recruit Sergeant
                                  ├─▶ Phalanx ──▶ Pikeman, Halberdier
                                  └─▶ Discipline ──▶ Shock Troops ──▶ Berserker

metalworking ──┬─▶ Knives ──▶ Knife Fighter, Cutter
               │           └─▶ Smelting ──▶ Forge, Ironworks
               ├─▶ Armor ──▶ Plate Armor ──▶ Heavy Cavalry, Riot Squad, Paladin
               └─▶ Bullet manufacturing ──▶ Small guns ──▶ Riflery ──▶ Rifle Squad
                                                       └─▶ Sniping ──▶ Sniper, Camo Sniper

Hotwire car ──▶ Driving ──▶ Auto Doctrine ──▶ Truck Rammer, Humve Gunner
            └─▶ Fix car ──▶ Mechanic, Field Engineer
```

Why this is fun: **a Sniper isn't a button you press, it's a project**. To recruit Sniper you needed Sniping, Sniping needed Small guns + Camo, Small guns needed Knives + Bullet manufacturing, Bullet manufacturing needed Factory working + Chemistry. Chemistry came from Education, Factory working came from Civic — so getting a Sniper visibly involves three other roles having pulled their weight. That's the Civ feel: a unit on the table is a paragraph of history.

### 3. The economy chain — Chief's actual influence

```
Bartering (free path: 1 gold) ──▶ Trading Post (1 gold)
                              └─▶ Currency ──▶ Mint, Market
                                          └─▶ Banking ──▶ Bank, Counting House
                                                     └─▶ Tariffs ──▶ Customs House
                                                                 └─▶ Grand Bazaar
                                          └─▶ Markets ──▶ Grand Bazaar
                                          └─▶ Economics (onPlay: +4 gold to bank)

Horseback riding ──▶ Trade Routes ──▶ Trade Caravan, Diplomacy (onAcquire: +2 gold)
Diplomacy.redEvent: tribute waiver (the chief's get-out-of-tribute card)
```

The chief now has a real reason to want **Bartering early** (cheap Trading Post + Mint via Currency) and **Diplomacy late** (stop tribute payments). And `Code of Law` (Civic) carries an `onPlayEffects: [{kind: 'tributeWaiver'}]` — the chief can play the card from hand to neutralize a bad battle outcome, which encodes the "leader uses diplomacy to cover for the army" fantasy.

### 4. The science chain — Education actually feeds everyone

```
Reading (free) ──▶ Writing ──▶ Library (building) ──▶ Pedagogy ──▶ School (building)
              └─▶ Math ──▶ Geometry ──▶ Architecture ──▶ Cathedral, Palace
                       ├─▶ Physics ──▶ Mechanics ──▶ Crossbowman (unit!)
                       │           └─▶ Optics ──▶ Camo Sniper (unit!)
                       │           └─▶ Fix electronics ──▶ Recon Drone
                       └─▶ Logic patterns
First Aid (free) ──▶ Medicine ──▶ Anatomy ──▶ Witch Doctor (Foreign unit!)
              └─▶ Chemistry ──▶ Bombs ──▶ Demolitions ──▶ Sapper, Bazooka
              └─▶ Biology ──▶ Botany ──▶ Apiary (Domestic!)
```

Education is the **cross-role tech tree**. A Sapper unit (Foreign) can't be recruited unless Education has done Chemistry, which fed into Fighting's Bombs, which fed into Demolitions. A Camo Sniper requires Optics (Education) ∩ Sniping (Fighting) ∩ Camo (Fighting). This is the lever that prevents one role from being "tech-isolated": Science can hand a green tech to Domestic that Domestic uses to unlock a building Foreign needs to recruit a unit Chief needs to win the next battle.

## Defending each card class

### Buildings — why these 58

**Tier 1 (cost ≤ 18, ~12 buildings).** Every starting player needs an early opener. The new entries (Cellar, Smokehouse, Trading Post, Hunter's Lodge, Apiary, Watchtower, Public Bath) cover the four resource axes (food / gold / morale / defense) at a price the chief can fund in round 1. They each map to a **single** beginner tech (Pantry, Cooking, Bartering, Foraging, bee keeping, Town Watch, Plumbing) so the player's first techs feel like real choices, not flavor.

**Tier 2 (cost 19–32, ~18 buildings).** This is where mixed-resource costBag earns its keep. **Smithy** (`{gold: 10, wood: 2, steel: 3}`) gates on Blacksmithing AND requires the player has a steel pipeline. **Glassworks** (`{gold: 12, wood: 2, production: 3}`) requires Glassblowing and feeds Optics. **Trade Caravan** wants gold + wood + horse + food — a card you can't just gold-rush, you have to coordinate.

**Tier 3 (cost 33–50).** The infrastructure tier — Bank, Tower, Aqueduct, Ironworks, Temple, Master Smith, Engineering College, School, Solar Array, Grand Bazaar. Each requires two techs and a substantial mixed costBag. **Aqueduct** wants `{gold: 18, stone: 8, production: 4}` and Plumbing + Bridges — a serious stone economy and adjacent civic theory.

**Tier 4 (cost 52–70).** Wonders / capstones. Citadel, Factory, Hospital, Palace, Arsenal, Power Plant, Grand Theater, Fortress. **Power Plant** at `{gold: 32, stone: 6, steel: 8, production: 6, science: 3}` is the largest costBag in the game on purpose — late game, the settlement's mature economy can pay it, and its 5 production output meaningfully snowballs Foreign recruitment. **Fortress** wants all-stone-and-steel because that's what a fortress is.

**Why this is fun:** every cost decision tells you what part of your economy needs to grow. If the Domestic seat keeps trying to buy Aqueducts but has no stone, that's a real conversation with the Chief: "I need Quarry Camp first" or "Chief, I need stone in my circle." The cards generate the table-talk.

### Units — why these 67

The original 32 units had nearly empty `requires` (mostly just "Auto"). The new file gives **every non-starter unit a tech path**. The starter Militia (Scout, Archer, Brute, indices 0-2) keep the empty `requires` because the foreign setup hand pulls those three.

**Three principles applied:**

1. **One tech, one unit shape.** Phalanx unlocks Pikeman + Halberdier (the anti-cavalry shape). Riflery unlocks Marksman + Designated Marksman + Rifle Squad (the focus-fire shape). Each tech yields a recognizable archetype, not a grab bag.

2. **Cross-tech requirements for elite units.** Camo Sniper needs Sniping + Camo + Optics (across two branches). Stealth Team needs Sneak + Ambush + Camo. These don't appear early, and when they do appear it's because the science seat earned them. Civ players know this feeling — "I finally have Plate Armor" is a moment.

3. **The "Auto" gate is real now.** Vehicles list `Hotwire car + Driving + Auto Doctrine` (or further combos like `Hotwire car + Big guns + Auto Doctrine + Combined Arms`) so the existing `altStats: "if no auto, different stats"` system makes narrative sense — the unit was *meant* to ride a hot-wired truck, and without that tech it's just a guy with a jerry can.

**Why this is fun:** a Foreign player flipping a hard battle now thinks "I've been holding back the Sapper because I haven't spent science on Demolitions — let me ask Science to push that next round." The tech tree visibly changes what's affordable to recruit. Foreign starts to feel like a Civ general, not a card-flipping minigame.

### Technologies — why these 82

The original 66 technologies had **empty strings everywhere** — `order: ""`, `cost: ""`, `buildings: ""`, `units: ""`. From a UI perspective, a player looking at a tech card saw the name and nothing else. The card couldn't sell itself.

Every tech now answers four questions a player asks at the table:

1. **"What do I need to take it?"** → `order: "after Foo + Bar"` and `costBag` (machine-readable for the science contribute path).
2. **"What does it let me build?"** → `buildings: "Trade Caravan"` (the Domestic seat now sees this on the card and knows to keep that building card playable).
3. **"What does it let me recruit?"** → `units: "Marksman, Designated Marksman, Rifle Squad"`.
4. **"What's the per-color use of this card?"** → `blueEvent`/`greenEvent`/`redEvent`/`goldEvent` are filled in with role-appropriate effects.

**16 new techs** were added to fill obvious wiring gaps (Cartography, Trade Routes, Roads, Engineering, Diplomacy, Tactics, Discipline, Phalanx, Cavalry Doctrine, Field Medicine, Plate Armor, Riflery, Heavy Weapons, Demolitions, Architecture, Power Grid, etc.) — each one is the logical bridge between a Tier-N tech and a Tier-N+1 unit/building.

**Selective `onPlayEffects`/`onAcquireEffects`** were added only where (a) the effect kind already exists in [src/game/events/effects.ts](../src/game/events/effects.ts) and (b) the thematic mapping is obvious:

- **Diplomacy** (`onAcquire`): +2 gold to bank — the moment trade opens, the chief feels the windfall.
- **Leadership** (`onAcquire`): +1 gold to bank — same idea, smaller because the tech is cheaper.
- **Code of Law** (`onPlay`): tribute waiver — the chief plays the card to skip a tribute payment.
- **Distraction** (`onPlay`): redraw battle top — exactly what distraction means in the fiction.
- **Drone Tactics** (`onPlay`): redraw battle top — drone scouted ahead.
- **Economics** (`onPlay`): +4 gold to bank — endgame play that pays for itself.

These six are the only ones with engine-side effects so a future content pass can layer more without touching the dispatcher.

## Why this set is fun (the game-level argument)

The game wants to feel like a small Civilization run played in 60 minutes by 4 people. For that to feel right, three things have to be true at the same time:

1. **You can see the next thing.** Every tech card now visibly says "I unlock X building and Y unit." A player at the table can read one card and form a 3-turn plan. That's the Civ tech-tree feeling — the future is legible.

2. **You can't get there alone.** Heavy Cavalry needs Horseback riding (Exploration) + Cavalry Doctrine (Fighting) + Plate Armor (Fighting) AND a Stables building (Domestic) AND ongoing horse/food economy. No single role can table-flip into endgame; the four players are forced to negotiate. That's exactly the multiplayer cooperation the four-role design exists to create.

3. **Early decisions matter.** Free-tier techs (Reading, Stick fighting, Lookout, Camping, First Aid, Foraging, Loot store, Loot corpse, Hiding, metalworking) are the seeds. Picking Reading first vs. Stick fighting first changes which branches are 2 turns away. That's the "first 30 seconds of a Civ game decide the next 8 hours" feeling, scaled down.

The cards individually are conservative — none of them are mechanic-breaking, they all use existing engine primitives. The fun comes from the **aggregate**: 58 buildings × 67 units × 82 techs is a deck deep enough that no two games look the same, but every card connects back to two or three others, so nothing in the deck is filler. That's the line a Civ-style game has to walk, and this set walks it.

---

**Files modified:** [src/data/buildings.json](../src/data/buildings.json), [src/data/units.json](../src/data/units.json), [src/data/technologies.json](../src/data/technologies.json). No engine, schema, or test changes. Typecheck, lint, and 497-test vitest suite all green.
