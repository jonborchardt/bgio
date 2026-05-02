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
   Carcassonne/Suburbia-ish domestic, MTG/Star-Realms-ish foreign,
   distribution-puzzle chief. A solo player owns all four; if the four
   roles shared one mechanic, the solo game would be four iterations of
   one decision.
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

- **Win** when `settlementsJoined >= 10`.
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
shared bank.

**Alternative considered**

- *Action grant* — give one role a special power per round, à la *Race
  for the Galaxy*'s "play 2x this turn." Not chosen because it pulled
  the chief's identity away from the resource-flow distribution decision.

### 3.2 Science

**Current (Option 1, hybrid):** 3×4 grid of science cards — one column
per color, fixed in role order (chief→gold, science→blue, domestic→green,
foreign→red). Lowest-level card in each column must be completed first.
Each card has 4 face-down tech cards under it that distribute on
completion. (Earlier revisions picked 3 of 4 colors per game and let the
fourth sit out; we dropped that variance because it consistently locked
one role out of receiving any tech that game.)

**Alternatives considered**

- *Option 1 (pure):* shuffle 27/36/27 cards into 9 piles; flip them all;
  player chooses from 9. Closer to *Splendor*. Rejected as too random.
- *Option 1b:* player drives the deal — flip one at a time and place in
  the smallest pile. More agency, but undercuts the surprise.
- *Option 2:* a single line of 5 cards, *Suburbia*/sister-game style;
  buy from the line, sweep to backfill. Rejected because the column-
  driven progression is nicer for visualizing tech tiers.
- *Option 3:* slot-conditioned costs (*Jaipur* sets / *Splendor* color
  requirements). Reserved for an expansion.

**Open questions**

- "Less random science, or science needs to not be so variable in
  greatness."
- "Cars without science" — i.e. some endgame plumbing should be
  reachable without a specific science being lucky enough to surface.

### 3.3 Domestic

**Current (Option 1):** placement on a grid; first building is free, every
other must be orthogonally adjacent. Adjacency rules are content-driven
(e.g. Mill near Granary → +1 food). Production is automatic at the start
of others-phase.

**Alternative considered**

- *Option 2:* placement-doesn't-matter. Rejected because adjacency is
  a cheap, content-driven design lever for emergent decisions.

Borrowed shape: *Carcassonne* / *Suburbia*.

### 3.4 Foreign

**Current (Option 1+ resolver):** a deterministic battle resolver against
flipped Battle cards, plus a Trade-card stream that produces public
trade requests on the center mat. Initiative-ordered turns; player picks
damage allocation; abilities are heal / splash / armor / single-use /
focus.

**Alternatives considered**

- *Option 2 — sortie play mats:* deploy armies onto missions / trades /
  defense.
- *Option 3 — small grid battle (3×2 vs 3×2):* full positional combat
  with cover/range/ammo etc. Rejected for V1 as too heavy for a parallel
  stage.
- *Option 4 — column/row defend:* if domestic is grid-based, defend along
  rows, à la *Galaxy Trucker*. Reserved for a later expansion.
- *Option 5 — MTG-style:* the closest spiritual ancestor for V1 combat.
- *Option 6 — Risk-style:* ruled out as too coarse.
- *Option 7 — tile-laying expedition:* place tiles defining what's at a
  square; send units to claim. Marked "think about" — could land in a
  later expansion.
- *Option 8 — outpost piles in the middle:* face-down piles that units
  can be sent to uncover and contest with AI opponents. Marked "think
  about." The win-condition currently sits closest to this idea via
  trade requests + battles incrementing `settlementsJoined`.

**Combat-resolver coverage gaps (intentional V1 omissions)**

The resolver implements: focus (parsed but doesn't yet differentiate
behavior), splash, armor, heal, single-use. It does **not** implement:

- `cover`, `ammo`, `reload`
- `vsBoss±N` modifiers
- `revealsScout`
- "−N initiative on turn 1"
- trapper post-attack initiative bumps
- player-driven ability target selection
- multi-target absorption per "round" (each enemy-on-player damage
  event consumes exactly one allocation, in resolver order)

When you implement one, add the keyword in `src/game/roles/foreign/abilities.ts`
AND wire it into `battleResolver.ts`. Keep the parser strict so silent
drops don't happen.

### 3.5 Opponent

**Current (Option 1):** a wander deck. One card flips at the end of each
round; effects dispatch through the same `EventEffect` taxonomy as
player event cards.

**Alternative considered**

- *Option 2:* a *Star Realms*–style stat-growing enemy that must be
  whittled down each round. Rejected for V1 because the wander-deck shape
  composes more cleanly with the no-fail-mode stance — wanders shape
  the village's tempo, they don't kill you.

**Open question**

- A growing enemy could later layer on top of the wander deck, not
  replace it.

## 4. Cross-role economy

The four roles are wired together by:

- **One shared bank.** Every role pulls from / pushes to it.
- **The chief's distribution decision.** Per round, the chief decides
  who gets what fuel for the round's actions.
- **The science → other-roles tech pipeline.** Completing a science
  card distributes its 4 tech cards to specific roles by color
  (`scienceComplete` in `src/game/roles/science/complete.ts`):
  - red → Foreign
  - gold → Chief
  - green → Domestic
  - blue → Science
- **Domestic buildings tax / discount Foreign.** Forge → −1 gold per
  unit recruited; Walls → −2 gold per unit upkeep; Tower → −4 gold per
  unit upkeep. Implemented in `roles/foreign/recruit.ts` and
  `roles/foreign/upkeep.ts` via `parseBenefit` over Domestic buildings.
- **Win condition is a Foreign output but not Foreign-only.** Both
  battle wins and trade fulfillments tick `settlementsJoined`. Trade
  fulfillment is open to *any* seat — so domestic-rich seats can drive
  win progress without ever fielding an army.

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
| Win threshold (settlements)   | 10      | `src/game/endConditions.ts` `endIf`                       |
| Science colors picked         | 3 of 4  | `src/game/roles/science/setup.ts` `setupScience`          |
| Tech cards under each science | 4       | same                                                      |
| Event hand size               | 4       | `src/game/events/state.ts` `HAND_SIZE`                    |
| Wander draws per round        | 1       | `src/game/opponent/wanderDeck.ts`                         |
| Building upgrade cost factor  | ×0.5    | `src/game/roles/domestic/upgrade.ts` (V1 stub)            |
| Unit release refund           | ×0.5    | `src/game/roles/foreign/release.ts`                       |

The lobby form (`SettlementSetupData`) exposes `turnCap`,
`chiefStipendPerRound`, `startingBank`, and `soloMode`/`humanRole`. New
per-match knobs go through that interface.

## 6. Content targets

Targets the V1 content pass aims for. Update as the deck reshapes.

| Deck                  | V1 size       | Notes                                                    |
| --------------------- | ------------- | -------------------------------------------------------- |
| Buildings (domestic)  | ~58           | Current pile in `src/data/buildings.json`.               |
| Technologies          | ~82           | Cross-role tech tree; spans 4 colors / 4 branches.       |
| Units (foreign)       | ~67           | Includes Militia starters.                               |
| Battle cards          | ~?            | Sized by `number` 1..4 tiers; deck stacks low-on-top.    |
| Trade cards           | ~?            | Same `number` 1..4 distribution.                         |
| Event cards           | 16 (4 / color)| Each role's hand is 4; cycle resets after exhausting.    |
| Wander cards          | ~24           | One drawn per round; reshuffles when empty.              |

Round-time target is **20–60 minutes** for a full match (roughly 20–60
rounds at the cap of 80).

The full pre-V1 wishlist sized for "20–60 turns": ~92 science cards
total, 20 domestic-played-twice = 40 buildings used, ~10 foreign units
played multiple times = 20 unit deck, 4 events × 4 roles = 16 events,
48-card opponent deck (8 bosses), 8×3 wanders + 8 directional wanders.
Treat these as historical targets; live content lives in `src/data/`.

## 7. Open design questions

Carried over from the original design doc, partially still live:

- **Random science variance.** The 3×4 grid still randomizes which
  specific card fills each (tier, color) cell per match, so some games
  will surface stronger combinations than others. Is the remaining
  variance acceptable, or do we need a "less random science" treatment?
- **Cars without science.** Endgame items shouldn't be locked behind a
  specific tech that may or may not appear.
- **Leader taxes.** Should the chief have a way to tax produced goods
  rather than only redistribute the bank's contents?
- **Event richness.** Beyond the immediate / modifier / awaiting-input
  buckets, should events have card-driven "this turn must…" mandates?
  (Examples in the original doc: "must do random science this turn,"
  "must buy cheapest science," "can swap 2 science cards," etc.)
- **Foreign incentive density.** The original doc asks: "There needs to
  be a necessity to have some science, domestic, and foreign…" —
  domestic discounts foreign upkeep, science feeds foreign units, but is
  the pressure on foreign strong enough that a player can't just under-
  invest in it forever?

## 8. Known V1 caveats / in-flight work

These are also in CLAUDE.md, repeated here so a designer reading this
file alone has the picture:

- **Hot-seat is single-tab playable end-to-end.** The seat picker tab
  strip lets the local viewer drive any seat; all role panels ship real
  "End my turn" moves.
- **Auth + accounts in V1 are SQLite-backed but the networked playtest
  is still unverified end-to-end** in production-like conditions.
- **Tech / wander / event content is starter-set.** Balancing comes
  after content lands.
- **Worker placement is a stub.** Placement bookkeeping works; richer
  worker effects on production are reserved for later.
- **Building upgrades are a stub.** ½× cost gold-only; richer upgrade
  content needs a data shape.
- **Battle resolver coverage is intentional and partial** (see §3.4).

## 9. The codename

"Settlement" is a placeholder. A real name is deferred until the
designer picks one. Don't sprinkle the codename into UI copy or content;
the engine symbol stays exported as `Settlement` until the rename pass.
