# Settlement — Game design notes

This file is the designer-facing companion to [Rules.md](./Rules.md).
**It is NOT the rulebook.** The rules of how the game is currently played
live in Rules.md; this file is for the things a designer needs to know
that don't belong in a rulebook:

- the design *premise* and the load-bearing constraints it imposes,
- alternative options that were considered for each role and why we
  picked the current one,
- balance levers, content targets, and tunables,
- open questions and known gaps.

If a rule and this file disagree, the rule wins. If a tunable changes,
update both files.

## 1. The bet

**One game, any seat count.** The mechanical surface area should be the
same at one player and at four players. The design treats seats and
roles as separate axes — there are always four roles in play, and player
count only decides who runs which ones.

Three load-bearing constraints fall out of that:

1. **Each role is a different mini-game.** Splendor-ish science,
   Carcassonne/Suburbia-ish domestic, tower-defense-ish defense (post-
   redesign — see §3.4), distribution-puzzle chief. A solo player owns
   all four; if the four roles shared one mechanic, the solo game would
   be four iterations of one decision.
2. **Co-op against the world, no fail mode.** Pressure can degrade
   outcomes (longer match, less score, worse position) but cannot end
   the match. This frees pressure systems from being tuned to "exactly
   hard enough to maybe kill you."
3. **Parallel non-chief phase.** The three non-chief roles act at the
   same time, not in turn order, so a 4-human game doesn't have anyone
   waiting for two other turns to act, and a 1-human game just runs the
   same code path with one human in all stages.

These three are encoded in code: see `src/game/index.ts`,
`src/game/phases/`, and `src/game/endConditions.ts`.

## 2. Win condition only

`endConditions.ts`:

- **Win** when `G.bossResolved === true`. `resolveBoss` in
  `src/game/track/boss.ts` flips this once the village has weathered the
  remaining boss attacks (each met threshold subtracts one attack from
  the printed `baseAttacks` budget; surviving the rest sets the flag).
  Per spec D26 the flag fires whether or not buildings are still
  standing afterwards.
- **Time up** when `round >= turnCap` (default 80). Not a loss — the run
  just ends so the server can record the score.

The cap also makes RandomBot fuzz games terminate cleanly.

There is **no design space** for adding a loss condition. If a sub-plan
proposes one, flag it.

## 3. Role design — alternatives we considered

The current implementation is one option per role. The rest of this
section captures alternatives that were considered (and references the
games they borrow from). When a future revision wants to swap a role's
mechanic, this is the menu.

### 3.1 Chief

**Current:** divvy gold and other resources from the bank into seats'
`In` slots; place workers; play one gold event per round; act on a
shared bank. The chief also has one super-power: **Tax** — once per
round, take `floor(stash / 2)` per resource from every non-chief seat;
the bank gains `ceil(taken / 2)` per resource and the rest evaporates.
Tax punishes hoarding (small hauls barely lose; large hauls bleed),
funnels resources into the chief's distribute pool with a one-round
delay (chief acts first next round), and pumps `economyHigh` toward
the boss's Economy threshold.

**Tax — balance levers** (all live; tune via these knobs only):

- **Ratio** — `floor(stash / 2)` per resource per stash. Tuning lever:
  swap to `floor(/3)` for softer; cap per-resource per-seat to limit
  the worst raids. Lives at the top of `src/game/roles/chief/tax.ts`.
- **Bank share** — `ceil(taken / 2)` per resource. Symmetric: changing
  this to `floor` shifts more loss to the village, `taken` (no
  evaporation) makes Tax pure consolidation.
- **Frequency** — once per round, free. Toggleable by switching the
  latch (`G.chief.taxedThisRound`) to a different cadence (per-game,
  per-N-rounds) or by gating on a stash cost the chief pays first.
- **Scope** — all 10 resource types. Trim to a "currency" subset
  (gold/wood/stone/steel/horse) to leave role-flavored resources
  (science/food/production/happiness/worker) untaxed if testers find
  the broad sweep too punitive on specialization.

**Alternative considered**

- *Action grant* — give one role a special power per round, à la *Race
  for the Galaxy*'s "play 2x this turn." Not chosen because it pulled
  the chief's identity away from the resource-flow distribution decision.

### 3.2 Science

**Current (post-redesign — The Library):** the science seat is the
village's research arm and gardener. Each round they spend their stash
at a face-up 6-slot **Library row** fed from a tier-stacked deck
(T1 → T2 → T3, all of one tier reveals before the next). Buying a card
pays a color × tier cost, hands the card to the recipient role's hand
(gold→chief, blue→science, green→domestic, red→defense, by `kind`),
and adds a -1-discount marker for that card's discount-resource to the
science seat's discount tableau. Burning a card moves it to the public
**lost-ideas pile** — gone forever, no recipient. The seat repeats
buy/burn until their stash drains or they choose to end. The
borrowed shape is *Splendor*: the discount snowball is the engine, and
specialization compounds.

The role's identity moves from *gift-giver* (occasional tech drop on
completion) to *village researcher / gardener* — every round they
choose what the village learns AND what it permanently never discovers.
The face-up burn pile across a full match is a visible record of paths
not taken.

**Why this design (the diagnosis the redesign was built to solve)**

The retired 3×4-grid mechanic gave the science seat one or two decisions
per round and a hard "1 completion per round" cap, so a richer round
didn't translate into more science output — extra resources just sat in
stash. The Library replaces both of those with stash-as-throttle: a
well-fed round buys multiple cards; a starved round burns one and ends.
The cap is now structural (the deck and stash) rather than a printed
rule, which lets the chief's distribution decision shape science
density round-to-round. The full diagnosis lives in the master plan
(`plans/science-library-redesign.md`).

**Alternatives considered**

- *Option 1 (pure):* shuffle every science card into 9 piles by tier;
  flip them all; player chooses from 9. Closer to early *Splendor*.
  Rejected as too random.
- *Option 1b:* player drives the deal — flip one at a time and place in
  the smallest pile. More agency, but undercuts the surprise.
- *Option 2:* a single line of 5 cards, *Suburbia*/sister-game style;
  buy from the line, sweep to backfill. The current Library is a fork
  of this with a 6-slot row, no contribute-and-complete pipeline, and
  the burn-1 pass option layered on top.
- *Option 3:* slot-conditioned costs (*Jaipur* sets / *Splendor* color
  requirements). Reserved for an expansion.

**Balance levers — paper-play tuning surface**

All cost numbers live as named constants at the top of
`src/game/library/costs.ts`:

- `T1_PRIMARY_AMOUNT = 4` — T1 cost (single resource).
- `T2_PRIMARY_AMOUNT = 7`, `T2_SECONDARY_AMOUNT = 2` — T2 cost.
- `T3_PRIMARY_AMOUNT = 10`, `T3_SECONDARY_AMOUNT = 3`,
  `T3_TERTIARY_AMOUNT = 2` — T3 cost.
- `RESEARCH_COST_TABLE` — the color → resource ladder
  (gold:gold/food/science, blue:science/wood/steel, green:wood/production/stone,
  red:stone/steel/gold). Cross-color reach is the design point: every
  color's T3 is enabled by some other color's lower tier.

The Splendor-style floor-of-1 lives in `effectiveResearchCost` in the
same file. There is no per-resource discount cap; the structural cap is
deck size (60 cards).

The boss-debuff thresholds (5 / 10 / 15 cards per color) and the V1
"sum across colors, flat reduction" implementation live in
`src/game/library/debuff.ts` (`TIER_1_THRESHOLD`, `TIER_2_THRESHOLD`,
`TIER_3_THRESHOLD`). Per-color → boss-flavor mapping is the open
question that keeps the V1 default flat.

**Open questions** (carried forward; full list in the master plan)

- **Per-color boss-flavor mapping.** The V1 debuff is a flat sum across
  colors. The intended shape is each color hitting a different boss
  attack flavor (gold ↔ economy, blue ↔ tech-counter, green ↔
  population, red ↔ military). Blocked on boss content gaining a
  `flavor` field on `ThreatPattern`.
- **Color-count rebalance toward 5×4×3 = 60.** The master-plan target
  is 5 of each (color × tier); the current content tagging in
  `src/data/` over-shoots in some buckets and under-shoots in gold. The
  V1 setup uses what it has; rebalancing is a content pass, not an
  engine change.
- **Tier-cost numbers (4 / 7+2 / 10+3+2).** Placeholder. Paper play
  should adjust toward the user's "multi-buy only when overfed" pacing.
- **Burn-pile end-of-game readout.** Should the win-resolution screen
  surface "the village never discovered: …" as a closing beat?

See `plans/science-library-redesign.md` for the full open-question list
and `plans/sl-orchestrator.md` for the implementation log.

### 3.3 Domestic

**Current (Option 1):** placement on a grid; first building is free, every
other must be orthogonally adjacent. Adjacency rules are content-driven
(e.g. Mill near Granary → +1 food). Production is automatic at the start
of others-phase.

**Alternative considered**

- *Option 2:* placement-doesn't-matter. Rejected because adjacency is
  a cheap, content-driven design lever for emergent decisions.

Borrowed shape: *Carcassonne* / *Suburbia*.

### 3.4 Defense (formerly Foreign)

**Current (post-redesign):** The Defense seat recruits units onto
non-center Domestic building tiles via `defenseBuyAndPlace`. Threats
flipped from the global event track walk a path toward the village
vault at `(0, 0)`; every unit whose Chebyshev range covers any cell on
the threat's pre-impact path gets one fire opportunity. Effective
strength folds the unit's printed `attack` / `range`, an optional
`placementBonus[]` matched to the building underneath, taught skills
granted by Science's Teach move, the global "vs <keyword> +N" matchup
bonus, and a one-shot drill token (always additive last). Surviving
threats damage their first impact tile, or center-burn if they reach
the village vault. The win condition is "village resolves the boss
card at the end of the track" (D25): the boss prints two thresholds
and a `baseAttacks` budget, met thresholds cancel attacks, and
surviving the rest flips `G.bossResolved`.

The full set of locked decisions lives in
[reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md);
the staged implementation is recorded under
`plans/defense-redesign-*.md` (all 22 sub-phases shipped via the
orchestrator in commit `5ddb643`).

### 3.5 Opponent (global event track)

The old wander deck is retired. Its role — a once-per-round flip that
mixed boons, modifiers, and pressure — is folded into the **global
event track** (D19, D20, G3): 10 phases × 3–4 cards each (a mix of
threats / boons / modifiers plus a single terminal boss), with the
next card always face-up so Defense can prepare for it. The chief
flips one track card per round at the chief→others phase boundary
(`chiefFlipTrack`); track *boons* deliver the bank / village bumps the
wander deck used to, and track *modifiers* push onto the same queue
the per-color event-card dispatcher consumes, then expire at end-of-
round. The terminal boss card flips `G.bossResolved` on survival.

**Original alternative considered for the V1 wander shape**

- A *Star Realms*–style stat-growing enemy that must be whittled down
  each round. Rejected at the time because the wander-deck shape
  composed more cleanly with the no-fail-mode stance. The track design
  (D19–D21) absorbs this concern — the boss card at the end of the
  track is the "final fight" the table prepares for over the run.

## 4. Cross-role economy

The four roles are wired together by:

- **One shared bank.** Every role pulls from / pushes to it.
- **The chief's distribution decision.** Per round, the chief decides
  who gets what fuel for the round's actions.
- **The science → other-roles content pipeline.** Each Library buy
  hands one card to one recipient role's hand (or techHand by `kind`):
  - gold → Chief's gold-event hand
  - blue → Science's blue hand / techHand
  - green → Domestic's hand / techHand
  - red → Defense's hand / techHand
  Routing lives in `src/game/roles/science/libraryBuy.ts`. The chief's
  distribute decision implicitly steers what science can afford to
  research that round (wood → green, stone → red, etc.), which is the
  low-comm version of "lobby for what to research" without chat.
- **Domestic buildings interact with Defense via placement bonuses.**
  Per the redesign (D18), the bonus is authored on the *unit* — a
  unit's card prints "+1 strength on Forge" or "+1 range on Tower" —
  rather than baked into the building. Phase 2 wires this through the
  combat resolver via `UnitDef.placementBonus[]`.
- **Win condition is a cross-role output, not Defense-only.** The boss
  card prints two thresholds (Science / Economy). Each met threshold
  cancels one attack from the boss's `baseAttacks` budget; remaining
  attacks fire through the same path / impact resolver as a normal
  threat. So winning is shaped by Science completions, the chief's
  bank-management high-water mark (Economy reads `G.economyHigh`), and
  the units Defense has on the grid to absorb whatever attacks the
  thresholds didn't cancel — all three non-chief roles plus the chief
  contribute to the outcome. (An earlier draft printed a third
  *Military* threshold; we removed it because units on the grid
  already shape boss outcomes mechanically — adding a "do you also
  have N strength?" check on top double-counted the same lever.)

The "web of techs" that ties the roles together (the Sniper recipe, the
Education branch as the unlocking root, etc.) is described narratively in
[`blogs/04-what-settlement-is-intended-to-be.md`](../blogs/04-what-settlement-is-intended-to-be.md).

## 5. Tunables

These are the dials a designer is most likely to want to touch. All have
code locations and defaults.

| Tunable                       | Default | Where                                                     |
| ----------------------------- | :-----: | --------------------------------------------------------- |
| Starting bank gold            | 3       | `src/game/resources/bank.ts` `initialBank`                |
| Per-round chief gold stipend  | 2       | `src/game/setup.ts` `CHIEF_STIPEND_DEFAULT`               |
| Chief starter worker pool     | 3       | `src/game/setup.ts` (`chief: { workers: 3 }`)             |
| Turn cap                      | 80      | `src/game/endConditions.ts` `TURN_CAP_DEFAULT`            |
| Win flag (boss-resolved)      | flag    | `src/game/endConditions.ts` `endIf`; flipped by `resolveBoss` in `src/game/track/boss.ts` |
| Library row width             | 6 slots | `src/game/library/setup.ts` `ROW_SIZE`                    |
| T1 / T2 / T3 cost amounts     | 4 / 7+2 / 10+3+2 | `src/game/library/costs.ts` (`T1_PRIMARY_AMOUNT`, …) |
| Boss-debuff thresholds        | 5 / 10 / 15 | `src/game/library/debuff.ts`                          |
| Event hand size               | 4       | `src/game/events/state.ts` `HAND_SIZE`                    |
| Track flips per round         | 1       | `src/game/roles/chief/flipTrack.ts` (D22)                 |
| Building upgrade cost factor  | ×0.5    | `src/game/roles/domestic/upgrade.ts` (V1 stub)            |
| Building maxHp range          | 1–4     | `src/data/buildings.json` per `BuildingDef.maxHp`         |

The lobby form (`SettlementSetupData`) exposes `turnCap`,
`chiefStipendPerRound`, `startingBank`, and `soloMode`/`humanRole`. New
per-match knobs go through that interface.

### 5.x Paper-play notes (issue 058)

- **Boss economy threshold (`12` in current content vs starting bank `3`
  + chief stipend `2/round`).** A 4-player game accumulating only the
  baseline stipend reaches 12 gold around turn 5; with stash inflows
  from production buildings the chief usually crosses 12 before the
  boss flips. Watch this in playtest — if the threshold ever feels
  unreachable, the path of least resistance is bumping
  `CHIEF_STIPEND_DEFAULT` rather than retuning the boss card. Revisit
  after the content rebalance pass (issue 008) lands.

## 6. Content targets

Targets the V1 content pass aims for. Update as the deck reshapes.

| Deck                  | V1 size       | Notes                                                    |
| --------------------- | ------------- | -------------------------------------------------------- |
| Buildings (domestic)  | ~58           | Current pile in `src/data/buildings.json`.               |
| Technologies          | ~82           | Cross-role tech tree; spans 4 colors / 4 branches.       |
| Units (defense)       | ~67           | Includes Militia starters; Phase 2 reshapes the schema.  |
| Track cards           | 30–40         | 10 phases × 3–4 cards; threats / boons / modifiers + boss.|
| Event cards           | 16 (4 / color)| Each role's hand is 4; cycle resets after exhausting.    |

Round-time target is **20–60 minutes** for a full match (roughly 20–60
rounds at the cap of 80).

The full pre-V1 wishlist sized for "20–60 turns": ~92 science cards
total, 20 domestic-played-twice = 40 buildings used, ~10 defense units
played multiple times = 20 unit deck, 4 events × 4 roles = 16 events,
30–40 track cards (1 boss + ~9 phases of threats / boons / modifiers).
Treat these as historical targets; live content lives in `src/data/`.

## 7. Open design questions

Carried over from the original design doc, partially still live:

- **Library variance.** The Library is shuffled within each tier-stack,
  so a match can reveal stronger T1 combinations early than another
  match. The discount snowball compounds the variance — early luck
  cheapens later turns. Acceptable, or do we want a partially-stratified
  reveal (e.g. one slot per color in T1)? See open question #4 in
  `plans/science-library-redesign.md`.
- **Cars without science.** Endgame items shouldn't be locked behind a
  specific tech that may or may not surface in the Library before the
  deck depletes.
- **Leader taxes.** Should the chief have a way to tax produced goods
  rather than only redistribute the bank's contents?
- **Event richness.** Beyond the immediate / modifier / awaiting-input
  buckets, should events have card-driven "this turn must…" mandates?
  (Examples: "must buy the cheapest available Library card," "may swap
  two cards in the Library row," "next Library buy is doubled.")
- **Defense incentive density.** The original doc asks: "There needs to
  be a necessity to have some science, domestic, and defense…" — the
  boss's two thresholds (Science / Economy) cancel attacks, and the
  attacks the village can't cancel are absorbed by Defense's units on
  the grid. So all three non-chief roles plus the chief contribute to
  the outcome, but the *thresholds* themselves are now Science +
  Economy only. Live question is whether the thresholds bite hard
  enough to force participation in those two roles without forcing a
  rigid build order, and whether the implicit "you also need Defense
  units" pressure is loud enough without a printed Military threshold.

## 8. Known V1 caveats / in-flight work

These are also in CLAUDE.md, repeated here so a designer reading this
file alone has the picture:

- **Hot-seat is single-tab playable end-to-end.** The seat picker tab
  strip lets the local viewer drive any seat; all role panels ship real
  "End my turn" moves.
- **Auth + accounts in V1 are SQLite-backed but the networked playtest
  is still unverified end-to-end** in production-like conditions.
- **Tech / track / event content is starter-set.** Balancing comes
  after content lands.
- **Worker placement is a stub.** Placement bookkeeping works; richer
  worker effects on production are reserved for later.
- **Building upgrades are a stub.** ½× cost gold-only; richer upgrade
  content needs a data shape.
- **Defense redesign — fully landed.** All 22 sub-phases (1.1 → 3.9)
  shipped via the orchestrator (commit `5ddb643`). Defense recruits
  units onto building tiles, the chief flips one track card per round,
  threats walk a path through the village and are intercepted by units
  in range, Science's Drill / Teach moves grant per-fire boosts and
  taught skills, and the boss card on the terminal phase resolves into
  a win when survived. See §3.4 / §3.5.

## 9. The codename

"Settlement" is a placeholder. A real name is deferred until the
designer picks one. Don't sprinkle the codename into UI copy or content;
the engine symbol stays exported as `Settlement` until the rename pass.
