# Settlement — Rules

A four-role cooperative strategy game for 1–4 players. "Settlement" is a
codename; a real title is deferred.

This file is the source of truth for **how the game is played**. Anything
beyond the rules — open questions, balance levers, alternative designs that
were considered — lives in [game-design.md](./game-design.md).

## 1. The premise

You and your fellow players run one shared post-apocalyptic village.
Whether one human plays alone or four humans split up, there are always
**four roles** in play, and the game is the same game at every player count.
Bots fill any seats humans don't.

You all win or lose together. There is **no fail mode** — only a win
condition and an outer time cap.

- **Win** when the village has joined **10 competing settlements** to
  itself (by tribute trade or by victory in battle).
- **Time up** if the round counter reaches its cap (default 80 rounds)
  before that. You record the score and try again.

## 2. Roles and seats

The four roles are **Chief**, **Science**, **Domestic**, and **Foreign**.
Roles are distributed across player seats by player count:

| Players | Seat 0                    | Seat 1     | Seat 2 | Seat 3 |
| :-----: | ------------------------- | ---------- | ------ | ------ |
| 1       | chief, science, domestic, foreign |    |        |        |
| 2       | chief, science            | domestic, foreign |  |    |
| 3       | chief, science            | domestic   | foreign |       |
| 4       | chief                     | science    | domestic | foreign |

A seat that holds more than one non-chief role acts in stage priority
**science → domestic → foreign**. (The seat takes the science stage; the
domestic and foreign actions happen automatically/inside that same player's
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
  contribution, domestic build/upgrade, foreign recruit/upkeep, trade
  fulfillment) come from the stash.

The center mat holds a single shared **trade-request** slot.

### Resources

Ten resource tokens exist: `gold`, `wood`, `stone`, `steel`, `horse`,
`food`, `production`, `science`, `happiness`, `worker`. Different costs
take different mixes; the stash is one combined pool of all of them.

## 4. Setup

At game start:

- The bank is seeded with **3 gold** (overridable per match).
- The chief gets a starter pool of **3 worker tokens**.
- **Science** lays out a 3×3 grid of science cards. Three of the four
  colors (red, gold, green, blue) are picked at random; one color sits
  out for this game. Each column is one color, ordered with the lowest
  level closest to the player. Under each science card go 4 random tech
  cards from the matching tech branch (red→Fighting, gold→Exploration,
  green→Civic, blue→Education).
- **Domestic** receives a hand containing every starter building, and an
  empty placement grid.
- **Foreign** builds a Battle deck and a Trade deck by sorting each card
  set by `number`, shuffling each same-number group, and stacking with
  the lowest numbers on top. Foreign starts with 3 starter Militia unit
  cards in hand and no units in play.
- **Events**: each color (gold/blue/green/red) has its own pool of cards;
  4 cards are dealt face-up to the seat that holds the matching role
  (chief→gold, science→blue, domestic→green, foreign→red).
- **Wander deck**: shuffled and placed face-down. One card flips at the
  end of each round and applies its effect.

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
- **Decide a trade-discard** when a Foreign trade flip collided with an
  occupied trade-request slot (see §5.2.4).

Players may *talk* about what they want during this phase; they are not
bound by what they say.

When the chief ends their phase: every seat's **In** drains into **Stash**
(the resources are now spendable). The next phase begins.

### 5.2 Others phase (parallel)

Every non-chief seat acts **at the same time**. Each seat enters the
stage matching its primary non-chief role (science / domestic / foreign).
The chief seat sits idle in `done`.

When the others phase begins:

1. Each seat's **In** drains into its **Stash**.
2. Every domestic seat's buildings **auto-produce**. Production is
   deterministic (no decision) and lands in that seat's **Out**, where
   it sits until the next chief phase sweep.

Then each role acts. A seat may only spend its own stash; it never reaches
into the bank or another seat's mat.

#### 5.2.1 Science

- May **play 1 blue event card** at any time during the round.
- **Contribute** resources from stash toward science cards on the grid.
  - Within each color column, only the **lowest-level uncompleted** card
    may receive contributions.
  - Contributions accumulate across turns; a card stays "in progress"
    until the running tally covers its full cost.
  - Over-contribution is silently capped at the card's remaining cost.
- **Complete** a science card whose paid tally covers its cost. On
  completion:
  - Spent resources move from the paid ledger to the bank.
  - The 4 tech cards under the completed card are distributed by color:
    - red tech → Foreign hand
    - gold tech → Chief hand
    - green tech → Domestic hand
    - blue tech → Science hand
  - **At most 1 science card may be completed per round.**
- May **play tech cards** from the science hand whose `onPlayEffects` are
  defined.
- **End my turn** when ready.

#### 5.2.2 Domestic

- May **play 1 green event card** at any time during the round.
- **Buy a building** from the domestic hand by paying its cost from
  stash. Place it on the building grid:
  - The first building goes anywhere.
  - Every subsequent building must be **orthogonally adjacent** (up, down,
    left, or right — no diagonals) to an already-placed building.
- **Upgrade an in-play building** by paying ⌊½ × base cost⌋ gold from
  stash; this increments the building's `upgrades` counter. (V1 stub —
  upgrade content is being layered in over time.)
- May **play tech cards** from the domestic tech hand.
- **End my turn** when ready.

Production runs automatically at the start of the others phase, so there
is no "produce" button to press. Each placed building contributes its
parsed yield (food/production/science/gold). A worker token on a building
**doubles** that building's yield contribution. **Adjacency rules** add
content-defined bonuses to specific neighbor pairs.

#### 5.2.3 Foreign

The foreign turn must be done in this order, with one constraint:

1. **Pay upkeep** for every in-play unit, in gold, from stash.
   - Per-unit upkeep starts at the unit's base cost and is reduced by
     the sum of every in-play Domestic building's `unitMaintenance`
     modifier (e.g. Walls: −2, Tower: −4 — clamped at 0 per unit).
   - **Units recruited this turn are exempt** from upkeep this round.
   - Upkeep is **all-or-nothing**: if stash gold can't cover the bill,
     foreign must release units (see below) first.
2. **Recruit** any number of units from the foreign hand by paying
   their cost from stash. The Domestic `unitCost` modifier (Forge: −1
   gold) discounts the gold portion of each unit's cost (clamped at 0);
   non-gold portions of a unit's cost are not discountable.
3. **Release** any in-play unit. The bank refunds **⌊½ × unit cost⌋
   gold per released unit** into the foreign stash (clamped to what the
   bank can pay). Releasing is the escape hatch when upkeep is
   unaffordable. The most recent release can be **undone** before
   another foreign action runs.
4. **Flip a battle card.** This pulls the top of the battle deck and
   commits every in-play unit to the fight; foreign now must resolve it
   by **assigning damage** (see §5.3 for combat resolution).
   - **Win** → reward listed on the card goes to the bank, and the
     village joins **+1 settlement**.
   - **Lose** → tribute listed on the card is **scheduled** as
     `pendingTribute`. The seat's turn ends.
5. **Flip a trade card** is allowed **only after a winning battle**, and
   only one trade flip per win.
   - The drawn card becomes a `TradeRequest` — a *demand* on the center
     mat: a `required` bag of resources and a `reward` bag.
   - If the trade slot is already occupied, the new card is **stashed**
     and the **chief decides** which to keep on their next decision (see
     §5.2.4).

May **play 1 red event card** at any time during the round, and may
**play tech cards** from the foreign tech hand.

**End my turn** when ready. Foreign cannot end the turn while
upkeep-eligible units remain unpaid.

#### 5.2.4 Trade-request decisions

The trade slot is **shared and public**. The seat that flipped it owns
it for audit/UI labeling, but **any active seat with the goods** can
**fulfill** it on their own turn:

- Pay `required` from stash to the bank.
- Receive `reward` from the bank into stash.
- The village joins **+1 settlement**.
- The slot clears.

When two trade flips collide, the chief — on their next chief phase —
must call `chiefDecideTradeDiscard` and pick whether to keep the
existing card on the slot or replace it with the pending one.

#### 5.2.5 Events

Each role may play **at most one event card per round** of its color
(chief→gold, science→blue, domestic→green, foreign→red). Event cards
fall into three buckets:

- **Immediate** — applied at play time (e.g. a resource gain to bank or
  stash, an extra event card added to a color deck, redrawing the top of
  the battle deck, or waiving the next tribute).
- **Modifier** — pushed onto a stack and consumed by the next matching
  move (e.g. *double science cost this turn*, *can't complete a card
  this turn*, *must complete the cheapest available*).
- **Awaiting input** — opens a follow-up move that asks the player to
  pick something (e.g. *swap two science cards*).

Within each color, a seat cycles through the deck: once you've played
every card in your hand, the cycle resets and the same cards become
playable again.

### 5.3 Combat (the battle resolver)

Combat is **deterministic** — there is no randomness in resolution. The
foreign player **commits** all in-play units to the flipped battle card,
then submits a **damage allocation plan**: for each enemy attack, which
of their own units absorb the incoming damage (per unit, by `defID`).

Resolver rules:

- Units take turns in **descending initiative order**; ties resolve by
  input order (stable).
- **Player-side targeting**: each player unit attacks the enemy with the
  **highest attack**, ties broken by input order.
- **Enemy-side targeting**: each enemy unit attacks the player unit with
  the **lowest HP**, ties broken by input order. (V1 only ships
  "attacks weakest"; the resolver supports other rules but no card
  uses them.)
- **Heal** units skip their attack to restore 1 HP to the lowest-HP
  ally that isn't at full. If no ally needs healing, they idle.
- **Splash** attackers strike a second enemy at full damage.
- **Armor** absorbs 1 incoming damage per hit (clamped at 0).
- **Single-use** attackers drop out after one attack.
- **Damage allocation rule.** Each unit you assign damage to must
  absorb either an exact lethal amount (its full HP) or a non-lethal
  amount strictly less than its remaining HP. You can't kill a unit by
  splitting damage across two of them and "leaking" leftovers — the last
  unit touched is the only one allowed to take partial damage.

Outcomes: `win`, `lose`, or `mid`. `mid` means the allocation plan
didn't terminate the fight; the move is rejected and state is left
unchanged.

Surviving units stay on the board. **Damaged units recover to full HP
between battles** (the resolver restores HP from the unit's `defense`
each fight).

### 5.4 End-of-round

After every non-chief seat has ended its turn, the engine runs the
end-of-round phase:

1. The **wander deck** flips one card. Its effect dispatches through the
   same effect system as event cards. (When the deck empties, the
   discard pile shuffles back in.)
2. Per-round bookkeeping resets:
   - Per-seat "I played an event of my color" flag is cleared.
   - Science's per-round completion counter is cleared.
   - Domestic's "produced this round" flag is cleared.
   - Foreign's "upkeep paid" and "recruited this turn" markers are cleared.
3. The round counter increments and the next chief phase begins.

## 6. Win condition

The village wins when **`settlementsJoined` reaches 10**.

- Winning a flipped battle card joins **+1 settlement**.
- Fulfilling a trade request joins **+1 settlement**.

There is no loss condition. If `round` reaches the **turn cap** (default
80, configurable per match) before the village joins 10, the run ends as
"time up" — the score is recorded and the players try again.

## 7. Quick reference

- **Bank** = shared pool. Chief acts on it directly.
- **In / Out / Stash** = per-non-chief-seat slots.
  - In ← chief distribution; drains to Stash on others-phase begin.
  - Out ← domestic production; sweeps to Bank on next chief-phase begin.
  - Stash = working pool, the only place spend moves draw from.
- **Roles by player count**: 1p = one seat with all four; 2p = chief+science / domestic+foreign; 3p = chief+science / domestic / foreign; 4p = one role each.
- **Per round**: each seat may play ≤1 event of its color; science completes ≤1 card; foreign pays upkeep once; domestic auto-produces.
- **Win @ 10 settlements joined.** No loss.
