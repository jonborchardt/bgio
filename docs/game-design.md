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

- **Win** when `G.bossResolved === true`. Phase 2.7 will flip this when
  the village resolves the boss card on the global event track. Until
  then, the flag is never set, so the only end-of-game outcome is
  time-up.
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
defense→red). Lowest-level card in each column must be completed first.
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

### 3.4 Defense (formerly Foreign)

The role is mid-redesign; see
[reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md)
for the locked decisions and the `plans/defense-redesign-*.md` directory
for the staged implementation. The short version: the old battle-deck /
trade-request loop has been retired, the role has been renamed from
*Foreign* to *Defense*, and the replacement is a global event track of
threats / boons / modifiers that walk toward the village's center tile,
plus a positional defense layer where Defense buys units and places them
on Domestic building tiles. The win condition becomes "village resolves
the boss card at the end of the track" (D25). Phase 2 plans cover the
track, the resolver, the defense moves, the science Drill / Teach moves,
and the boss flow.

### 3.5 Opponent (global event track)

The Phase 2 redesign retires the old wander deck wholesale. Its role
— a once-per-round flip that mixed boons, modifiers, and pressure —
is now folded into the **global event track** (D19, D20, G3): 10
phases × 3–4 cards each (mix of threats / boons / modifiers / a
single boss), with the next card always face-up so Defense can
prepare for it. The chief flips one track card per round at the
chief → others phase boundary; track *boons* deliver the bank /
village bumps the wander deck used to, and track *modifiers* bend
rules for one round before being cleared at end-of-round.

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
- **The science → other-roles tech pipeline.** Completing a science
  card distributes its 4 tech cards to specific roles by color
  (`scienceComplete` in `src/game/roles/science/complete.ts`):
  - red → Defense
  - gold → Chief
  - green → Domestic
  - blue → Science
- **Domestic buildings interact with Defense via placement bonuses.**
  Per the redesign (D18), the bonus is authored on the *unit* — a
  unit's card prints "+1 strength on Forge" or "+1 range on Tower" —
  rather than baked into the building. Phase 2 wires this through the
  combat resolver via `UnitDef.placementBonus[]`.
- **Win condition is a cross-role output, not Defense-only.** The boss
  card prints three thresholds (Science / Economy / Military). Each
  threshold met → one fewer attack the boss makes. So winning is
  shaped by all three non-chief roles plus the chief's bank-management
  decisions, not just by Defense's units on the grid.

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
| Win flag (boss-resolved)      | flag    | `src/game/endConditions.ts` `endIf` (set by Phase 2.7)    |
| Science colors picked         | 3 of 4  | `src/game/roles/science/setup.ts` `setupScience`          |
| Tech cards under each science | 4       | same                                                      |
| Event hand size               | 4       | `src/game/events/state.ts` `HAND_SIZE`                    |
| Track flips per round         | 1       | `src/game/roles/chief/flipTrack.ts` (D22)                 |
| Building upgrade cost factor  | ×0.5    | `src/game/roles/domestic/upgrade.ts` (V1 stub)            |
| Building maxHp range          | 1–4     | `src/data/buildings.json` per `BuildingDef.maxHp`         |

The lobby form (`SettlementSetupData`) exposes `turnCap`,
`chiefStipendPerRound`, `startingBank`, and `soloMode`/`humanRole`. New
per-match knobs go through that interface.

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
- **Defense incentive density.** The original doc asks: "There needs to
  be a necessity to have some science, domestic, and defense…" — Phase 2
  ties the boss's three thresholds (Science / Economy / Military) to all
  three non-chief roles, so under-investing in any one of them shows up
  as boss attacks at the end of the run. Live question is whether the
  thresholds bite hard enough to force participation without forcing a
  rigid build order.

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
- **Defense role mid-redesign (Phase 1 complete).** Defense ships no
  user-facing moves yet; Phase 2 brings the global event track, the
  defense moves, science Drill / Teach, and the boss flow. See §3.4.

## 9. The codename

"Settlement" is a placeholder. A real name is deferred until the
designer picks one. Don't sprinkle the codename into UI copy or content;
the engine symbol stays exported as `Settlement` until the rename pass.
