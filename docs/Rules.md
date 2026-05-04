# Settlement — Rules

A four-role cooperative strategy game for 1–4 players. "Settlement" is a
codename; a real title is deferred.

This file is the source of truth for **how the game is played**. Anything
beyond the rules — open questions, balance levers, alternative designs that
were considered — lives in [game-design.md](./game-design.md).

> **Status note (Defense redesign — Phase 1 complete).** The fourth role
> is in mid-redesign: it has been renamed from *Foreign* to **Defense**,
> the old battle-deck / trade-request loop has been retired, and the
> replacement (a global event track + village defense grid + boss-resolves-
> to-win flow) is being staged in over Phase 2. While that work is in
> flight, the role is intentionally inert in code, the only end-of-game
> outcome is the time-up cap, and several sections below are placeholders.
> See [reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md)
> for the locked decisions and the `plans/` directory for the staged
> implementation order.

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

The center mat is empty during Phase 1. Phase 2 will populate it with the
**Global Event Track** strip — past / current / next-card slots — that
replaces the old battle and trade decks.

### Resources

Ten resource tokens exist: `gold`, `wood`, `stone`, `steel`, `horse`,
`food`, `production`, `science`, `happiness`, `worker`. Different costs
take different mixes; the stash is one combined pool of all of them.

## 4. Setup

At game start:

- The bank is seeded with **3 gold** (overridable per match).
- The chief gets a starter pool of **3 worker tokens**.
- **Science** lays out a 3×4 grid of science cards — one column per
  color, fixed in role order: **chief (gold), science (blue),
  domestic (green), defense (red)**. Each column is ordered with the
  lowest level closest to the player. Under each science card go 4
  random tech cards from the matching tech branch (gold→Exploration,
  blue→Education, green→Civic, red→Fighting).
- **Domestic** receives a hand containing every starter building, an
  empty placement grid, and the fixed **center tile** at `(0, 0)` (the
  village vault — always present, never destroyed; see Phase 2 for the
  threat-resolution interaction).
- **Defense** is currently inert. The role's hand and grid presence
  arrive in Phase 2.
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
    - red tech → Defense hand
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
parsed yield (food/production/science/gold), reduced by current damage.
A worker token on a building **doubles** that building's yield
contribution (after the damage proration). **Adjacency rules** add
content-defined bonuses to specific neighbor pairs.

#### 5.2.3 Defense

*Coming.* The role exists as a stub during the Phase 1 redesign work; it
ships no moves beyond `End my turn`. Phase 2 will introduce buy / place /
play-tech moves, units placed on domestic building tiles, the path-based
threat resolver, and the boss-resolves-to-win flow. See
[reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md)
and the `plans/defense-redesign-*.md` files for the staged work.

#### 5.2.4 Events

Each role may play **at most one event card per round** of its color
(chief→gold, science→blue, domestic→green, defense→red). Event cards
fall into three buckets:

- **Immediate** — applied at play time (e.g. a resource gain to bank or
  stash, an extra event card added to a color deck).
- **Modifier** — pushed onto a stack and consumed by the next matching
  move (e.g. *double science cost this turn*, *can't complete a card
  this turn*, *must complete the cheapest available*).
- **Awaiting input** — opens a follow-up move that asks the player to
  pick something (e.g. *swap two science cards*).

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
     latches and completion counter are cleared.
   - Domestic's "produced this round" flag is cleared.
   - The chief's per-round `flippedThisRound` latch is cleared.
4. The round counter increments and the next chief phase begins.

## 6. Win condition

*Coming.* The game's win condition will be **resolving the boss card**
on the global event track (a single card at the end of the track that
makes a deterministic number of attacks based on which of the village's
science / economy / military thresholds it has met). Phase 2.7 will
flip the engine-internal `bossResolved` flag to `true` when the village
survives the boss; until then, that flag is never set.

**Currently, the only way the game ends is the time-up cap.** If `round`
reaches the **turn cap** (default 80, configurable per match), the run
ends as `timeUp` — the score is recorded and the players try again.
There is no loss condition.

## 7. Quick reference

- **Bank** = shared pool. Chief acts on it directly.
- **In / Out / Stash** = per-non-chief-seat slots.
  - In ← chief distribution; drains to Stash on others-phase begin.
  - Out ← domestic production; sweeps to Bank on next chief-phase begin.
  - Stash = working pool, the only place spend moves draw from.
- **Roles by player count**: 1p = one seat with all four; 2p = chief+science / domestic+defense; 3p = chief+science / domestic / defense; 4p = one role each.
- **Per round**: each seat may play ≤1 event of its color; science completes ≤1 card; domestic auto-produces.
- **End condition (current)**: only `timeUp` at the turn cap. The boss-
  resolved win arrives in Phase 2.7.
