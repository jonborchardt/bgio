# Science redesign — The Library

**Date:** 2026-05-05
**Status:** design spec, ready for paper-play; not yet broken into implementation sub-phases.
**Supersedes:** the relevant chunks of [reports/science-juice-ideas.md](../reports/science-juice-ideas.md) (none of the 20 candidates are adopted as-is; this is closest to a fork of #4 with #5/#14 ideas dropped).
**Related:** Defense redesign D27 (drill / teach) — assumed already shipped and untouched by this plan.

## What this changes

Replaces today's science role mechanics — the 3×4 grid, the lowest-first column rule, the multi-round `contribute` accumulation, and the 1-completion-per-round cap — with a single market called **The Library**. Every round, the science seat buys cards from a public 6-slot row and burns adjacent cards in the same step, draining their stash through a Splendor-style discount snowball that gets cheaper as they specialize.

The role's identity moves from *gift-giver* (who occasionally drops a tech) to *village researcher / gardener* (who decides every round what the civilization learns and what it permanently never discovers).

## Identity statement

The science seat is the village's research arm. Each round they advance one role's potential AND choose what the civilization will never discover. The face-up burn pile across a 30-round game is a visible record of paths not taken.

## Core mechanic — The Library

### The row

- **6 face-up slots**, fed from a single science deck.
- Deck is built as **three tier-stacks shuffled internally, stacked T1 on top → T2 → T3**. All T1 reveals before any T2; all T2 before any T3. Visible to the table.
- During science's turn, the row only depletes (buys + burns empty slots; no mid-turn refill).
- **Refill to 6** at end of science turn from the deck.

### The cards

The card *is* the recipient's content — a real domestic building, defense unit, science tech, or chief event drawn from [src/data/](../src/data/) (or its successor for chief events). Each card carries:

- **Color** — gold / blue / green / red. Determines who receives the card on buy + which resources science pays.
- **Tier** — 1 / 2 / 3, badged on card. Implicit from which tier-stack it came from.
- **Deploy cost** — printed on the card. What the *recipient* pays from their stash later, exactly as buildings/units/techs work today. Untouched by this plan.
- **Effect text** — whatever it has today. Untouched.

The science research cost is **not printed on the card**. It's derived from color × tier via a fixed table (see below).

### Per-tier cost rule (the resource ladder)

Every tier-N card costs N distinct resources. The Nth (newest) resource is the one whose discount the card grants when bought.

| Tier | Cost shape | Discount granted |
| --- | --- | --- |
| T1 | 4 of primary | -1 of primary |
| T2 | 7 of primary + 2 of secondary | -1 of secondary |
| T3 | 10 of primary + 3 of secondary + 2 of tertiary | -1 of tertiary |

Floor: 1 per resource type (Splendor rule). A T1 wood card with -3 wood discount still costs 1 wood.

No wilds. No multi-resource discounts. One card → one discount on one named resource.

### Color → resource ladder (proposal, needs paper play)

Resources used: gold, science, wood, stone, steel, production, food (7 of the 10 in [src/game/resources/types.ts](../src/game/resources/types.ts)).

| Color | Role | T1 (primary) | T2 adds (secondary) | T3 adds (tertiary) |
| --- | --- | --- | --- | --- |
| Gold | Chief | gold | food | science |
| Blue | Science | science | wood | steel |
| Green | Domestic | wood | production | stone |
| Red | Defense | stone | steel | gold |

Discounts granted by color/tier:

- Chief T1 → -1 gold • Chief T2 → -1 food • Chief T3 → -1 science
- Science T1 → -1 science • Science T2 → -1 wood • Science T3 → -1 steel
- Domestic T1 → -1 wood • Domestic T2 → -1 production • Domestic T3 → -1 stone
- Defense T1 → -1 stone • Defense T2 → -1 steel • Defense T3 → -1 gold

**Cross-color reach** (the design point of the ladder — high-tier of one color is enabled by low-tier of another):

- Defense T3 needs gold → enabled by Chief T1 buys
- Domestic T3 needs stone → enabled by Defense T1 buys
- Science T3 needs steel → enabled by Defense T2 buys
- Chief T3 needs science → enabled by Science T1 buys

Each color's T3 becomes affordable through a different color's lower tiers. Specializing in one color goes deep on that color's primary; reaching T3 anywhere requires touching at least one other color.

### Discount cap is structural, not numeric

There is no max-discount-per-resource rule. The cap emerges from card supply: 5 cards per color per tier × 4 colors × 3 tiers = **60 cards in the deck**. Each card grants -1 of one specific resource. To stack -10 wood discount you'd have to buy all 5 Domestic T1s (-5 wood) AND all 5 Science T2s (-5 wood) — 10 specific cards out of 60. Reachable but expensive in opportunity cost.

## Per-turn flow

Science's turn during the others-phase. Loop:

1. **Buy** any face-up card. Pay its tier×color cost from stash, applying tableau discounts (floor 1 per resource). Place the card in the recipient role's hand/tableau (or in your own science tableau if it's blue). *Also* place a copy/marker of the card in your **discount tableau**, sorted by color, granting its -1 discount on future buys forever.
2. **Burn** any face-up card. Move it to the public **lost-ideas pile** on the central board. Its content is gone forever.
3. Repeat from (1) if you can afford another buy and want to.

Or instead of looping: **burn 1, pass.** No-buy turn. Still moves the deck forward toward the next tier; still costs the village a card.

End of turn: refill row to 6 from the deck.

The science move set on the panel — `buy`, `burn`, `pass` (plus drill / teach from D27, plus blue-tech play, plus blue-event play) — should be presented under the heading **science moves** so the role's panel stays distinct from generic per-turn affordances.

### What science gets from blue buys

Same as today (per #12 in the prior conversation): blue cards distribute to science. Science still plays blue techs from their hand on their turn. The Library buy IS the distribution event for blue cards — there's no separate "completion."

## Win-assist thresholds (boss-debuff levels)

Per the user's #6/#7 — color counts don't win, they debuff the boss. Each color is independent.

| Cards bought of color X | Boss debuff against the threats X protects |
| --- | --- |
| 5 | tier-1 debuff |
| 10 | tier-2 debuff |
| 15 | tier-3 debuff |

Specifics of "what each color's debuff does to the boss" depend on boss content shape — flagged as open question below. The threshold COUNTS are deliberate: 15 is exactly the size of one color's full deck (T1 + T2 + T3 × 5 each), so reaching tier-3 debuff requires buying every card of that color and burning none.

Reaching multiple thresholds across colors is possible but requires running through more deck. With ~30 rounds × ~1 buy/round average + ~30 burns total, the deck depletes around the round count — so the `science → boss` connection is genuinely a season's-worth of decisions, not a snap-shot.

## Content authoring

- **Card count**: 5 per color per tier × 4 colors × 3 tiers = **60 cards total**.
- **Equal color counts within each tier** (per user's #9). 5 of each color in T1, 5 of each in T2, 5 of each in T3.
- **The card's content (effect, deploy cost) is the recipient role's existing content type.** Domestic team authors buildings; defense authors units; science authors techs; chief authors events. The science layer doesn't touch the printed card.
- **Tier badge** added to every card so the deck-stacking and lost-ideas pile read at a glance.
- **Existing science card content** (the 12 cards from today's `src/data/` science set): treat as scrapped. Keep the JSON around in case we want to revert, but assume new authoring (per user's #11).

## What survives from today

- Stash → spend pipeline.
- Color → role distribution (now 1 card per buy, not 4 per completion).
- Blue events + blue techs in science's hand and the science tableau.
- Drill / Teach (D27) — fully untouched.
- Chief flips event track at chief↔others phase boundary (orthogonal system).

## What's gone

- The 3×4 grid; the colored columns; the lowest-first column rule.
- The `contribute` move and multi-round resource accumulation.
- The 1-completion-per-round cap. Replaced by stash-limit (a richer round = more buys, which is the hook chief uses to influence science indirectly).
- 4-tech-cards-per-completion distribution. Now 1 tech per buy.

## Inter-role pull (low-comm version)

Per user's #10, the table doesn't have chat. So there's no real-time lobbying about which card to burn. The inter-role pull becomes structural rather than dramatic:

- **Chief feeds science via distribute.** Chief deciding to send wood to science is implicitly saying "research domestic." Sending stone is saying "research defense." Multi-resource feeds enable T2/T3.
- **Each buy is a gift to one role.** Other roles passively receive their hand-fillers based on what science chose to research.
- **Each burn closes a door.** The lost-ideas pile is the silent record of what each role didn't get to build.

No chief-king lobbying. Just chief-funded specialization.

## Implementation phases (sketch — not yet broken out as 1.1, 1.2, ...)

Order matters; later phases depend on earlier.

1. **Data schema** — add `tier` and `scienceColor` (gold/blue/green/red) to the union of buildings/units/techs/events. Cost-table function `researchCost(card)` derived from color × tier per the table above.
2. **Library state** — `G.library`: row of 6 slots, tier-stacked deck, lost-ideas pile, per-seat discount tableau (per-color stacks of bought-card markers).
3. **Moves** — `scienceBuy(slot)`, `scienceBurn(slot)`, `scienceEndTurn`. End-of-turn refill in `turn.onEnd`.
4. **Discount engine** — `effectiveResearchCost(card, tableau)` computing post-discount with floor-1.
5. **Recipient handoff** — on buy, append the card to the recipient role's hand/tableau just as today's distribution does.
6. **Boss debuff hooks** — count reads from the discount tableau per color; passed into boss-resolution math at thresholds 5/10/15.
7. **UI** — new `<LibraryRow>` central component (likely on the central board strip alongside the event track), `<LossPile>` viewer, `<DiscountTableau>` per-seat. Science panel rewires to `Buy / Burn / Pass`.
8. **Content** — author 60 cards (or port subset of existing buildings/units/techs/events into the new schema as a starting deck).
9. **Tests** — new headless tests for buy/burn/refill/discount-stack/floor-1/threshold-firing. Update Rules.md.
10. **Cleanup** — remove the 3×4 grid components, contribute move, completion handler, 4-card distribute, lowest-first walker, cap-checker, and any tests against them. Old JSON kept for reference.

## Open questions before paper-play / implementation

1. **What does each color's boss debuff actually do?** The thresholds at 5/10/15 are clear; the *effects* depend on boss content. Probably each color hits different boss attack types — gold reduces economy attacks, blue reduces tech-counter attacks, green reduces population attacks, red reduces military attacks. Needs a pass against current boss/track resolver code.
2. **Tier cost numbers (4 / 7+2 / 10+3+2).** Placeholder. Paper play should adjust toward the user's "multi-buy only when overfed" pacing.
3. **T2 secondary / T3 tertiary resource picks per color.** The proposed table above is one workable web, but specific assignments (e.g. "domestic T3 needs stone") are interpretive. Final picks should fit each role's content team's flavor.
4. **Should the Library row span colors per slot, or have a slight stratification?** The user picked equal color counts per tier (#9). Within a tier, the 6-slot row will hold a random color mix. Acceptable, or do we want a lane per color (2-2-2 by some grouping)?
5. **Burn pile read at end of game?** The lost-ideas pile is on the central board, face-up, throughout the game. Should the win-resolution screen call out "the village never discovered: ..." as a closing beat?
6. **What if the science seat can't afford anything AND doesn't want to burn?** Pure skip with no burn? Today's burn-1-and-pass forces motion — confirming "skip without burning" is not an option (a skipped science turn still costs the village 1 card). Re-confirm after a few paper rounds.
7. **Discount tableau cap?** None proposed. The structural cap (60 cards in deck) makes infinite stacking impossible. Confirming we don't need a hard per-resource cap on top.
8. **Cost rule for blue (science) cards.** Science buying their own blue card means paying science from their own stash. Is this fine, or does the science seat have a special discount on blue (e.g. -1 of all costs because it's their own field)? I'd ship without the special case.
9. **Tier-deck reshuffle.** When the deck depletes mid-game, science just stops buying. The boss showdown still resolves on its own clock. Confirming we don't need a reshuffle of the burn pile back into the deck.
10. **Does the discount tableau persist across rounds?** Yes, obviously — the snowball is the whole point. Just calling it out so the implementation phase doesn't accidentally reset on round-end.
