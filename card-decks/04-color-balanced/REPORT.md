# Set 4 — Color-Balanced Library

**Design goal:** make all four boss-debuff thresholds (gold / blue / green /
red, at 5 / 10 / 15 cards) genuinely reachable. Currently the buyable
library deck is wildly skewed: gold and blue starve, green and red flood.

## Why this matters

`src/game/library/debuff.ts` reads each color's count off the science seat's
discount tableau and applies a flat strength reduction to boss attacks
(level 1 at 5 cards, level 2 at 10, level 3 at 15). Reaching the level-3
threshold for *every* color caps the boss debuff at −12 strength per
attack — but **only if the deck contains enough cards of every color to
*reach* 15**.

### Current per-color buyable counts

| Color | Buildings | Units | Techs | Events | Total |
|---|---|---|---|---|---|
| gold | 0 | 0 | 19 | 4 | **23** |
| blue | 0 | 0 | 27 | 4 | **31** |
| green | 58 | 0 | 38 | 4 | **100** |
| red | 0 | 76 | 48 | 4 | **128** |

Gold has 23 buyable library cards in the entire deck. The level-3
threshold is 15 — so a science seat can hit gold-3 *only* if 65% of every
gold card ever appearing in the row gets bought. Practically, **gold
level-3 is unreachable in a typical match**. Blue is barely reachable.
Green and red are trivial.

### This set's per-color buyable counts

| Color | Buildings | Units | Techs | Events | Total |
|---|---|---|---|---|---|
| gold | 0 | 0 | 22 | 8 | **30** |
| blue | 0 | 0 | 23 | 8 | **31** |
| green | 42 | 0 | 21 | 8 | **71** |
| red | 0 | 51 | 22 | 8 | **81** |

Gold gains 7 techs + 4 events ⇒ +11 cards. Blue gains 0 net (it was OK).
Green sheds 17 techs + 16 buildings; red sheds 26 techs + 25 units. The
result is a deck where gold-3 is *reachable* with focused play, not just
mechanically possible.

## What's locked

The schema doesn't let us color-balance *any way we want*: the
`scienceLibraryBuy` move routes by color, and only certain seats have
moves to act on each card type:

- Buildings ⇒ green ⇒ domestic. Only domestic has `domesticBuyBuilding`.
- Units ⇒ red ⇒ defense. Only defense has `defenseBuyAndPlace`.
- Techs / events ⇒ any of the four colors. Each role has a `playTech`
  move tied to its hand.

So buildings and units are forced into green and red respectively. The
colors we can rebalance are **techs** and **events**. This set does both.

## What got recolored

### Techs (22/23/21/22 across colors, was 19/27/38/48)

Recolored gold (was misc → gold for diplomatic / economic intent):
- `Loot Corpse`, `Bartering`, `Foraging`, `Diplomacy` — already gold; kept.
- New gold techs: `Tribute`, `Treaties`, `Mercenaries`, `Trade Routes`, `Tariffs`, `Currency`, `Banking`, `Markets`, `Beer Brewing`, `Holidays`, `Festivals`, `Court Etiquette`, `Embassy`, `Treasury`, `Philosophy`, `Heraldry`, `Leadership`, `Political Theory` (the wide gold-flavored set).
- These are all "non-military, non-build" techs whose effect is most usefully landed in the chief's hand.

Recolored blue (was scattered → blue for science / theory / medical):
- All medical techs (`Anatomy`, `Field Medicine`, `Triage`) → blue (was red).
- All map / observation techs (`Maps`, `Cartography`, `Compass`, `Optics`, `Tracking`, `Lookout`) → blue (some were already blue).
- All structural-theory techs (`Engineering`, `Architecture`, `Bridges`) → blue.
- Combat-coordination techs (`Tactics`, `Discipline`, `Logistics`) → blue (these grant doctrine, not weapons).

Recolored green (was many → kept the build / civic ones, slightly trimmed):
- All buildings unlocks (`Smithing`, `Smelting`, `Masonry`, `Mining`, `Plumbing`, etc.) stayed green. Domestic plays civic infrastructure.
- Trimmed green by moving combat-doctrine and academic techs to red and blue.

Recolored red (was 48 → kept clearly-military: Phalanx, Cavalry Doctrine, Plate Armor, Sharpshooting, Siegecraft, Heavy Weapons):
- Removed 26 techs that were thematically more chief / science / domestic and recolored them.

### Events (8 per color, was 4)

Doubled to 8 each. Mixed-resource events were added (`Diplomatic Gift`,
`Translation`, `Civic Pride`, `Captured Arms`) so each color has variety
beyond a flat resource ladder.

## Why this set is better

1. **All four boss-debuff thresholds are reachable.** Gold-3 was effectively unreachable in the current deck (only 23 gold cards exist and a level-3 needs 15 in a tableau). This set lifts gold to 30 and blue to 31, both of which can reach level 3 with focused play.
2. **Colors actually mean something.** When a tech is tagged blue it's because it's a science / medical / theoretical card; when it's gold it's an economic / diplomatic card. The current deck's color tagging looks more like "which resource the unlock card outputs" than a coherent role-routing.
3. **Each role's hand has a clear identity.** With this set, the chief's gold-hand reliably contains diplomacy / treasury / currency cards; the science seat's blue-hand contains medical / theoretical / engineering cards. Today, a tech ending up in a hand often feels random.
4. **The win-assist mechanic feels intentional, not accidental.** A player can plan "I'll dig in on gold-debuff" because gold is now a real path. Currently that path is closed.
5. **Events are richer.** 32 events (was 16) with 8-per-color and several mixed-resource entries gives more variety per draw.

## Open follow-ups (V2)

- **Per-color → boss attack flavor mapping.** `src/game/library/debuff.ts` notes this is open question #1 in the master plan: each color's debuff should ideally reduce a flavor-matched boss attack. Until `ThreatPattern.flavor` exists, all colors apply a flat reduction. This set doesn't fix that but it makes the question worth answering.
- **Buildings + Units locked to green/red.** A future code change could let `scienceLibraryBuy` route by *card type* (BuildingDef→green, UnitDef→red, regardless of `scienceColor`) and then use `scienceColor` purely for the discount tableau. That'd let buildings be tagged blue (and grant a blue discount marker) while still going to domestic. This set works within the current routing rule.
- **Set 4 didn't change card counts as aggressively as Set 1.** A merger of Sets 1 + 4 would be the strongest single proposal: lean **and** color-balanced.
