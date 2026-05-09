# Settlement — Rules

A four-role cooperative strategy game for 1–4 players. "Settlement" is a
codename; a real title is deferred.

This file is the source of truth for **how the game is played**. Anything
beyond the rules — open questions, balance levers, alternative designs that
were considered — lives in [game-design.md](./game-design.md).

> **Status note (Defense redesign — landed).** The fourth role has been
> renamed from *Foreign* to **Defense**. The old battle-deck / trade-request
> loop is retired; the replacement (a Global Event Track + per-tile units
> + boss-resolves-to-win flow) is fully wired through the engine and the
> hot-seat UI. All 22 sub-phases under
> [`plans/defense-redesign-*.md`](../plans/) are complete (see
> [reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md)
> for the locked decisions). One ride-along simplification: the boss's
> printed thresholds are **two** (Science / Economy), not three —
> the earlier Military threshold was retired because boss attacks are
> already shaped by the units the Defense seat has placed on the path.

## 1. The premise

You and your fellow players run one shared post-apocalyptic village.
Whether one human plays alone or four humans split up, there are always
**four roles** in play, and the game is the same game at every player count.
Bots fill any seats humans don't.

You all win or lose together. There is **no fail mode** — only a win
condition and an outer time cap. (See §6.)

## 2. Roles and seats

The four roles are **Chief**, **Science**, **Domestic**, and **Defense**.
Roles are distributed across player seats by player count:

| Players | Seat 0                    | Seat 1     | Seat 2 | Seat 3 |
| :-----: | ------------------------- | ---------- | ------ | ------ |
| 1       | chief, science, domestic, defense |    |        |        |
| 2       | chief, science            | domestic, defense |  |    |
| 3       | chief, science            | domestic   | defense |       |
| 4       | chief                     | science    | domestic | defense |

A seat that holds more than one non-chief role acts in stage priority
**science → domestic → defense**. (The seat takes the science stage; the
domestic and defense actions happen automatically/inside that same player's
turn.)

## 3. The shared bank, and per-seat player mats

There is one shared **bank** of resources. The chief acts on the bank
directly and **owns no mat**.

Every non-chief seat has a **player mat** with three slots:

- **In** — resources the chief just placed for this seat. Drained into
  **Stash** automatically when the seat begins its turn.
- **Out** — resources the seat produced this round. Swept into the bank
  automatically at the start of the next chief turn.
- **Stash** — the seat's working pool. **All spend moves** (science
  contribution, domestic build/upgrade/repair) come from the stash.

The center mat itself is intentionally empty. The table-shared
**Global Event Track** strip (past / current / next-card slots) is
rendered above the village grid by the central-board frame, not on the
center mat.

### Resources

Ten resource tokens exist: `gold`, `wood`, `stone`, `steel`, `horse`,
`food`, `production`, `science`, `happiness`, `worker`. Different costs
take different mixes; the stash is one combined pool of all of them.

## 4. Setup

At game start:

- The bank is seeded with **6 gold** (overridable per match;
  `SettlementSetupData.startingBank`). The default was bumped from 3
  during the early-game pacing pass — combined with the +2/round chief
  stipend it gives the chief 8g for round-1 distribution, enough for
  domestic to land its first 5g starter (Cellar / Homestead / Mason's
  Yard / Pen / Lumberyard) in round 2.
- The chief gets a starter pool of **3 worker tokens**.
- **The Library** is built and seeded. The Library deck is composed of
  every tagged card from the active deck under `card-decks/<id>/`
  (chief events, science techs, domestic buildings, defense units),
  sorted into three tier-stacks (T1 → T2 → T3) and shuffled within
  each tier. The face-up **row** is filled to **6 cards** off the top
  of the stacked deck. The **lost-ideas pile** and every seat's
  **discount tableau** start empty.
- **Domestic** receives a hand containing every starter building, an
  empty placement grid, and the fixed **center tile** at `(0, 0)` (the
  village vault — always present, never destroyed; see Phase 2 for the
  threat-resolution interaction).
- **Defense** receives a starter hand of the militia units listed in
  the active deck's `units.json` with no `requires` gate (Scout, Archer,
  Brute). The hand is a pool — recruiting a unit does not consume the
  card; tech-driven unlocks push additional units onto the same pile.
  Recruited units occupy non-center building tiles on the Domestic
  grid.
- **Events**: each color (gold/blue/green/red) has its own pool of cards;
  4 cards are dealt face-up to the seat that holds the matching role
  (chief→gold, science→blue, domestic→green, defense→red).
- **Global Event Track**: a fixed 10-phase sequence of cards
  (threats / boons / modifiers / boss). The chief flips one card per
  round at the chief→others phase boundary. Track *boon* cards play the
  role the retired wander deck used to (one-shot rules-bending or bank
  gains); *modifier* cards bend rules for one round only.

## 5. The round

Every round walks through three phases.

### 5.1 Chief phase

When the chief phase begins (round ≥ 1), in this order:

1. The bank receives the **chief stipend** (default **+2 gold/round**).
2. Every non-chief seat's **Out** is **swept into the bank**.
3. Control passes to the seat holding the chief role.

The chief may then, in any order:

- **Play 1 gold event card** at any time during the round.
- **Distribute** any amount of resources from the bank into any non-chief
  seat's **In** slot. Distribute is reversible during the chief phase: the
  chief can also pull resources back out of `In` into the bank until they
  end their phase.
- **Place workers** on Domestic-grid buildings from the chief's worker
  reserve (1 worker per cell, max 1).
- **Tax** (once per round). The chief levies a tax on every non-chief
  stash. For each of the 10 resource types, every non-chief seat loses
  `floor(stash / 2)` of that resource. The bank gains `ceil(taken / 2)`
  per resource; the rest **evaporates** — that's the cost of using the
  power. Small hauls barely lose (take 1 → bank gets 1, lose 0); big
  hauls bleed (take 7 → bank gets 4, lose 3). The chief seat owns no
  mat and is never taxed. Because the bank rises, Tax also pumps
  `economyHigh`, which counts toward the boss's Economy threshold.

Players may *talk* about what they want during this phase; they are not
bound by what they say.

When the chief ends their phase: every seat's **In** drains into **Stash**
(the resources are now spendable). The next phase begins.

### 5.2 Others phase (parallel)

Every non-chief seat acts **at the same time**. Each seat enters the
stage matching its primary non-chief role (science / domestic / defense).
The chief seat sits idle in `done`.

When the others phase begins:

1. Each seat's **In** drains into its **Stash**.
2. Every domestic seat's buildings **auto-produce**. Production is
   deterministic (no decision) and lands in that seat's **Out**, where
   it sits until the next chief phase sweep. Yield is **prorated by
   building damage** — a building at less than full HP contributes
   proportionally less.

Then each role acts. A seat may only spend its own stash; it never reaches
into the bank or another seat's mat.

#### 5.2.1 Science

- May **play 1 blue event card** at any time during the round.
- May **play tech cards** from the science hand whose `onPlayEffects` are
  defined.
- May **Drill** or **Teach** Defense units (per Phase 2.6 of the defense
  redesign): Drill grants a unit a one-shot +1-strength token; Teach
  grants a one-shot taught skill. Each is gated by a per-round latch.
- The bulk of the science seat's turn is spent at **The Library**.

##### 5.2.1.1 The Library

The Library is a face-up 6-slot **row** on the central board, fed from a
single tier-stacked deck (all T1 cards reveal before any T2; all T2
before any T3). The cards in the row are **real domestic buildings,
defense units, science techs, and chief events** drawn from the active
deck under `card-decks/<id>/` (selected via `card-decks/deck.config.json`
or the `VITE_DECK` build env var), each tagged with a **color** (gold /
blue / green / red) and a **tier** (1 / 2 / 3). The science research
cost a card prints in the Library is
not the card's deploy cost — it is derived from the card's color × tier
via a fixed table (see below) and is what the **science** seat pays to
move the card into the recipient role's hand.

On their turn, the science seat may, in any order, repeat as many times
as their stash allows:

- **Buy** any face-up card. Pay its effective research cost from stash
  (base cost minus the seat's discount tableau, floored at 1 per
  resource). The card is **handed to the recipient role** by color —
  gold to the chief's gold-event hand, blue to the science seat's blue
  hand (or techHand by `kind`), green to the domestic hand or techHand,
  red to the defense hand or techHand. A copy of the bought card is
  also pushed onto the science seat's **discount tableau**, granting
  -1 of the card's discount-resource on every future Library buy.
- **Burn** any face-up card. The card is moved to the public
  **lost-ideas pile** on the central board. Its content is gone forever
  — no buyer ever receives it. No payment, no tableau update.

The row only depletes during the science seat's turn (no mid-turn
refill). When the seat **ends my turn**, the row refills from the deck
back to 6.

##### 5.2.1.2 Per-card research cost

Costs come from `src/game/library/costs.ts`. Each tier-N card costs N
distinct resources; the Nth (newest) resource is the one whose discount
the card grants when bought.

| Color   | T1 (primary)        | T2 adds (secondary)         | T3 adds (tertiary)         |
| ------- | ------------------- | --------------------------- | -------------------------- |
| Gold    | gold                | food                        | science                    |
| Blue    | science             | wood                        | steel                      |
| Green   | wood                | production                  | stone                      |
| Red     | stone               | steel                       | gold                       |

Amounts (placeholder, paper-play tunable):

- T1: **4 of primary**.
- T2: **7 of primary + 2 of secondary**.
- T3: **10 of primary + 3 of secondary + 2 of tertiary**.

Floor: **1 per resource type** that appears in the base cost (Splendor
rule). A wood-discount of -5 against a T1 wood card (cost 4 wood) still
costs 1 wood.

##### 5.2.1.3 The discount tableau

Each card the science seat buys grants -1 on its **discount-resource**
(the highest-tier resource in its cost) on every future Library buy.
Discounts stack with no per-resource cap — the structural cap is the
deck itself (5 cards × 4 colors × 3 tiers = 60 cards). The tableau
persists across rounds; the snowball is the whole point.

##### 5.2.1.4 The lost-ideas pile

The lost-ideas pile is **public, face-up, permanent**. It is a visible
record of what the village never discovered across the run. Burned
cards never return to the deck and are never re-shuffled.

##### 5.2.1.5 Boss-debuff thresholds

The total count of cards bought of a given color (across every seat's
discount tableau) crosses one of three thresholds at **5 / 10 / 15**
cards, granting that color a tier-1 / tier-2 / tier-3 boss debuff.
Reaching tier-3 in a single color requires buying every card of that
color across all three tiers and burning none.

V1 implementation (`src/game/library/debuff.ts`): the four colors'
debuff levels are summed and applied as a flat strength reduction on
every boss attack (floored at 0). A per-color → boss-flavor mapping is
deferred until boss content gains a `flavor` field.

- **End my turn** when ready. The Library row refills to 6 from the deck.

#### 5.2.2 Domestic

- May **play 1 green event card** at any time during the round.
- **Buy a building** from the domestic hand by paying its cost from
  stash. Place it on the building grid:
  - The first building must be **orthogonally adjacent** to the fixed
    center tile at `(0, 0)`.
  - Every subsequent building must be **orthogonally adjacent** (up, down,
    left, or right — no diagonals) to an already-placed building (the
    center tile counts as already-placed for this rule).
  - Each placed building enters at full HP (`hp = maxHp`), where `maxHp`
    is printed on the building card (1–4).
- **Upgrade an in-play building** by paying ⌊½ × base cost⌋ gold from
  stash; this increments the building's `upgrades` counter. (V1 stub —
  upgrade content is being layered in over time.)
- **Repair a damaged building** via `domesticRepair(cellKey, amount)`.
  Cost: ⌈cost × amount/maxHp⌉ from stash, restoring up to `amount` HP
  (capped at `maxHp − hp`). Repair is the new domestic spend sink that
  closes the loop on stash burn from threat damage.
- May **play tech cards** from the domestic tech hand.
- **End my turn** when ready.

Production runs automatically at the start of the others phase, so there
is no "produce" button to press. Each placed building contributes its
parsed yield (food, production, science, gold, wood, stone, steel,
horse), reduced by current damage. A worker token on a building
**doubles** that building's yield contribution (after the damage
proration). **Adjacency rules** add content-defined bonuses to specific
neighbor pairs.

The eight resources above are the verbs `parseBenefit` recognizes in a
building's `benefit` string (see
`src/game/roles/domestic/parseBenefit.ts` `RESOURCE_VERBS`). The
**raw-material** group (wood, stone, steel, horse) appears in the
Library cost ladders (blue → wood, green → wood / stone, red → stone /
steel) and on a few unit-recruit `costBag`s (cavalry needs horse), so
the active deck **must** contain at least one production path for each
ladder resource — a building, a track-boon, or an event. The
[`liveDeck.test.ts`](../tests/data/liveDeck.test.ts) linter enforces
this at CI time so a future deck swap can't accidentally lock the
science seat out of a color past T1.

#### 5.2.3 Defense

- May **play 1 red event card** at any time during the round.
- **Recruit a unit** by paying its cost from stash and placing one
  instance onto a non-center Domestic building tile via
  `defenseBuyAndPlace(unitName, cellKey)`. Stacks are uncapped — multiple
  units may share a tile. The recruited unit's card stays in the
  Defense hand (the hand is a pool, not a single-use deck), so a unit
  type can be recruited repeatedly.
- May **play tech cards** from the Defense red-tech hand
  (`defensePlay`). Red tech grants new units, drill / teach interactions
  with Science, or per-unit modifiers consumed by the threat resolver.
- **End my turn** when ready.

Threats from the global event track resolve at the chief→others phase
boundary the round after they were flipped. Each threat walks a path
toward the village center; every unit whose Chebyshev range covers any
cell on the threat's pre-impact path gets one fire opportunity. A
unit's printed `range` IS its Chebyshev radius: `range = 1` covers
the unit's own tile plus the 8-neighbour ring, `range = 2` adds the
next 16-cell ring, and so on (`range = 0` covers nothing). The
in-engine helper `tileCoversPath(unitTile, range, path)` enforces this. Firing
order is first-strike before non-first-strike, then placement order.
Effective unit strength folds (in this order) the unit's printed stats,
its `placementBonus[]` matched to the building underneath it,
`taughtSkills` granted by Science's Teach move, the global "vs <keyword>
+N" matchup bonus, and finally a one-shot `drillToken` (+1 strength,
always additive last). Surviving threats damage their first impact tile
on the path; if the threat reaches the village vault at `(0, 0)` it
**center-burns** instead — see `src/game/track/centerBurn.ts`.

#### 5.2.4 Events

Each role may play **at most one event card per round** of its color
(chief→gold, science→blue, domestic→green, defense→red). Event cards
fall into three buckets:

- **Immediate** — applied at play time (e.g. a resource gain to bank or
  stash, an extra event card added to a color deck).
- **Modifier** — pushed onto a stack and consumed by the next matching
  move (e.g. *double the next Library buy's cost*, *can't burn this turn*).
- **Awaiting input** — opens a follow-up move that asks the player to
  pick something (e.g. *swap two cards in the Library row*).

Within each color, a seat cycles through the deck: once you've played
every card in your hand, the cycle resets and the same cards become
playable again.

### 5.3 End-of-round

After every non-chief seat has ended its turn, the engine runs the
end-of-round phase. The next round's track card is already face-up
(telegraphed) at this point — the chief flipped this round's card
between chiefPhase and othersPhase, so end-of-round is pure
bookkeeping:

1. **Defense regen.** Every alive unit on the grid heals
   `unit.regen` HP (plus any taught `accelerate` skill), capped at the
   unit's effective max HP. Drill markers on units that didn't fire
   this round persist into the next round (they are consumed at
   fire time, not by end-of-round cleanup).
2. **One-round modifiers expire.** Any `track.activeModifiers` left on
   the stack are cleared.
3. **Per-round latches reset.**
   - Per-seat "I played an event of my color" flag is cleared.
   - Science's per-round `scienceDrillUsed` / `scienceTaughtUsed`
     latches are cleared. (The Library's discount tableau and
     lost-ideas pile persist — they are not per-round state.)
   - Domestic's "produced this round" flag is cleared.
   - The chief's per-round `flippedThisRound` latch is cleared.
   - The chief's per-round `taxedThisRound` latch is cleared.
4. The round counter increments and the next chief phase begins.

## 6. Win condition

The game is **won** by surviving the **boss card** at the end of the
global event track. The boss prints two thresholds and a `baseAttacks`
budget; each threshold the village has already met cancels one attack
from the budget. Remaining attacks are dispatched as synthetic threats
through the same path / fire / impact pipeline as a normal threat.
After the last attack lands, `G.bossResolved` flips to `true` and
`endIf` returns `{ kind: 'win' }`. The win flag fires whether or not
the village still has buildings — surviving the printed attacks is the
condition (per spec D26: there is no fail mode).

The two thresholds are:

- **Science** — count of Library cards bought across every seat's
  discount tableau (`countLibraryCardsBought` in
  `src/game/track/boss.ts`, summing the lengths of
  `G.library.discountTableaus`).
- **Economy** — running maximum of `G.bank.gold` ever observed during
  the match (`G.economyHigh`). The high-water-mark reading means a chief
  who briefly stockpiles before redistributing keeps credit toward the
  threshold.

If the round counter ever reaches the **turn cap** (default 80,
configurable per match) before the boss is resolved, the run ends as
`timeUp` — the score is recorded and the players try again. There is
no loss condition.

## 7. Quick reference

- **Bank** = shared pool. Chief acts on it directly.
- **In / Out / Stash** = per-non-chief-seat slots.
  - In ← chief distribution; drains to Stash on others-phase begin.
  - Out ← domestic production; sweeps to Bank on next chief-phase begin.
  - Stash = working pool, the only place spend moves draw from.
- **Roles by player count**: 1p = one seat with all four; 2p = chief+science / domestic+defense; 3p = chief+science / domestic / defense; 4p = one role each.
- **Per round**: each seat may play ≤1 event of its color; science buys/burns Library cards until stash drained or they choose to end; domestic auto-produces.
- **End condition**: **win** when the village survives the boss card at
  the end of the global event track (`G.bossResolved`); otherwise
  **timeUp** if `round` reaches the turn cap (default 80). No loss
  condition.
