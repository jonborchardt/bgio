# Set 3 — Synergy Engine

**Design goal:** make spatial play matter. Most units carry 1–3 placement
bonuses tied to specific buildings, so where defense places a unit on the
domestic grid is a real decision, not a cosmetic one.

## Counts (deck → diff vs current)

| Deck | Current | This set | Δ |
|---|---|---|---|
| Buildings | 58 | 30 | −48% |
| Units | 76 | 40 | −47% |
| Technologies | 132 | 56 | −58% |
| Events | 16 | 16 | 0 |

Smaller decks intentionally — synergies are only legible if every card has
a clear "best home." Adding redundancy dilutes the placement decision.

## Placement-bonus coverage

The current deck has placement bonuses on **2 of 76 units** (Watchman→Tower
range+1, Sapper→Forge strength+1). This set has placement bonuses on **39
of 40 units** (Brute is the lone exception — it's deliberate; the starter
"big lad with a club" should feel like a generalist).

| Effect kind | Current | This set |
|---|---|---|
| `strength` | 1 | 28 |
| `range` | 1 | 22 |
| `regen` | 0 | 13 |
| `hp` | 0 | 11 |
| `firstStrike` | 0 | 6 |

Every effect kind in the schema is now exercised across multiple units.

## Synergy patterns introduced

These are the design archetypes — pick a unit and the set tells the player
where to put it.

1. **Wall Garrison Pikes** — Spearman / Pikeman / Halberdier on Walls. The wall stat block (cost 16, hp 4, +1 def) is the cheapest tile for first-strike polearm spam. Spearman gains firstStrike on Walls; Pikeman gains hp; Halberdier gains both.
2. **Tower Archery** — Archer / Marksman / Crossbowman on Tower. Tower's attack-side payoff. Marksman is the canonical Tower placement (range 4 → 6 with the +2). Watchman gives the cheap V1 starter version.
3. **Smith-line Berserkers** — Sapper / Saboteur / Berserker / Axeman / Cutter on Forge / Ironworks / Smithy. The damage-dense, melee-aggressive line wants the smith family.
4. **Cavalry Stables Anchor** — Light / Heavy Cavalry + Lancer on Stables. Heavy Cavalry ports to Drill Yard (+strength) and Garrison (regen) for staying power; Light Cavalry is the cheap hit-and-run.
5. **Cathedral / Garrison Healing** — Paladin / Battle Medic / Witch Doctor get regen here. Medic + Garrison is the canonical "fortified field hospital" pattern.
6. **Civic Spend Sinks** — Forager / Miller / Potter / Treasurer / Trader / Scholar / Pioneer are cheap units (cost 3–6) tied to economy buildings (Granary, Mill, Pottery, Mint, Counting House, Library, Workshop). They give the defense seat a way to defend the village's economic spine while domestic builds it.
7. **Cellar Smuggler** — the starter Cellar (cost 5, hp 1) becomes meaningful: Smuggler / Knife Fighter / Saboteur all gain placement bonuses there. The "cheap junk" tile is now an *ambush* tile.

## What got cut and why

- The current deck's near-duplicate units (Marksman vs Long Gunner vs Designated Marksman vs Camo Sniper) become **one** Marksman with three placement homes. The variety is now spatial, not statistical.
- The post-apoc auto/electronics tree is gone (same as Set 1 — it doesn't fit the synergy idiom and there's no building family to anchor it).
- Several T3 buildings (Cathedral, Palace, Fortress, Citadel) survived because they're synergy *anchors*; lower-priority T3 buildings (Master Smith, Solar Array, Engineering College) were cut.

## Why this set is better

1. **The grid actually matters.** With one placement bonus on 2 of 76 units, the current grid is mostly "where is there room?" With placement bonuses on 39 of 40, the grid asks "where does this unit *belong*?" — which is a genuinely interesting question.
2. **Tabletop-playable.** Every placement bonus is something a real player can resolve at a real table by reading the unit card and looking at the tile under their token. No hidden math.
3. **Defense gains a real placement decision.** Today, defense buys a unit and picks a tile mostly for adjacency. With this set, the right tile depends on the *building underneath* — and the wrong tile is a real cost, not just slightly suboptimal.
4. **Domestic and Defense have to talk.** If domestic builds a Tower in column 0 and defense needs an archer at column 2, that's a real coordination problem. Today they barely interact.
5. **Combos teach the game.** A new player learns "Pikeman on Walls" the first time they see the placement bonus fire. That's the kind of moment-to-moment "oh, I get it" that drives engagement.

## Open follow-ups (V2)

- The schema only allows `placementBonus` on units, not buildings. A V2 expansion could let a building grant a *bonus to all adjacent units* (e.g. Standard Bearer's aura is duplicated by a Drill Yard). That's a code change; this set works within the current schema.
- Per-color science distribution is unchanged from current — Set 4 attacks that.
- Several civilian units (Scholar, Trader, Treasurer, Potter) reference V1.5 mechanics (sci aura, gold per round) that aren't currently implemented. They're listed in the notes for paper play; the bonuses on those cards are real and will work today.
- Cost re-balance was lightweight — the tier curve was preserved roughly. Set 5 attacks costs systematically.
