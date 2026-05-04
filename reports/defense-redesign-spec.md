# Defense redesign — narrowed spec

**Date:** 2026-05-03
**Predecessors:**
- [foreign-mini-game-ideas.md](./foreign-mini-game-ideas.md)
- [defense-redesign-report.md](./defense-redesign-report.md)

**Status:** narrowed. All major design choices are locked. This report
is meant to be the source the next sub-plan reads when porting the
redesign into `docs/game-design.md` §3.4 and into code under
`src/game/roles/defense/`.

---

## 1. Locked decisions (the spec, in one place)

The numbering below is canonical — sub-plans should reference these
IDs (D1, D2, …) when they implement.

| ID | Decision |
| --- | --- |
| **D1** | Role rename: `foreign` → `defense`. Folder, types, moves, UI panel, tech color, ai.enumerate. |
| **D2** | The domestic grid remains **free-form, tile-based** (current Manhattan-1 adjacency rule stays). It is anchored by a single fixed **center tile** at `(0, 0)`. |
| **D3** | The **center tile** is a new shared *village vault* — physically a tile at `(0, 0)`, conceptually the union of every seat's stash. When a threat reaches center, resources are taken from the **pooled stash** and the loss is split **evenly + randomly** across non-chief seats. (Per user, "c… random but even split when hit.") |
| **D4** | All non-chief stash spends still come from each seat's individual stash mat as today; the "pool" is a logical view that exists only at the moment of a center-tile hit. |
| **D5** | Threats are **instant**: appear → resolve → done, all in the round they flip. No multi-round march. |
| **D6** | Each threat card prints **direction** (N / E / S / W) + **offset** (an integer column/row index from center). The threat walks toward center along that column or row; its target is the **first occupied tile in its path**. |
| **D7** | Each threat has a single **strength** stat that is both its HP (units chip it down) and its damage (leftover strength hits the building, then continues toward center). |
| **D8** | Combat is fully deterministic. Pure math, no dice, no allocation puzzle. |
| **D9** | Each unit has: **strength** (damage on fire), **range** (a Chebyshev radius of tiles it can defend), **first-strike?** (boolean), **HP** 1–4, **regen** (HP/round). Plus a *printed* effect line (e.g. "+1 vs Cavalry threats") — see D10. |
| **D10** | **No fixed type enumeration**. Per-card matchup text is hand-authored on each unit and threat (user picked option (i)). The combat resolver reads a small set of well-known keywords ("vs Cavalry +1," "ignores Armor") rather than walking a typed table. |
| **D11** | Units are placed on a **domestic building tile**. Stacking allowed; unit count per tile is uncapped for V1 (revisit if playtest goes silly). |
| **D12** | Units are **immobile** once placed. |
| **D13** | When several units sit on the same tile and that tile takes damage from a threat that broke through, units die in **placement order** — first placed, first killed. The UI must visualize stack order (user requirement). |
| **D14** | Defense has **no upkeep**, **no battle deck**, **no trade-request slot**, **no offensive mode**. Those parts of the current foreign role are removed entirely. |
| **D15** | Buildings now carry **HP 1–4** (small integer, per-building, tied loosely to cost — *not* 1-to-1). Each building def declares its own `maxHp` in `buildings.json`. |
| **D16** | Yield prorating: `yieldLost = ⌈yield × damagePct⌉` where `damagePct = (maxHp − hp) / maxHp`. (The punishing reading from the previous report — even one HP off bites.) Buildings cannot be destroyed; minimum hp = 1 (locked). |
| **D17** | Domestic gains a `domesticRepair(cellKey, amount)` move. Cost: `⌈cost × amount/maxHp⌉` from stash. Repair = the new domestic spend sink that closes the loop on stash burn. |
| **D18** | Placement bonuses are authored **on the unit**, not on the building. A unit's card lists which buildings give it which bonus (e.g. Sapper card: "+1 strength on Well"; Watchman card: "+1 range on Tower"). The combat resolver reads `UnitDef.placementBonus[]` at fire time and checks the building underneath the unit's tile. Same building can mean different things to different units — design surface, no extra rules. `BuildingDef.unitBonuses` does not exist. |
| **D19** | The **Global Event Track** replaces the wander deck and the battle deck. It contains 30–40 cards, structured as **10 phases × 3–4 cards/phase**. Cards inside a phase are shuffled; phase difficulty climbs monotonically. The next card is **face-up** at all times (telegraphed). |
| **D20** | The track is a mix of: **threats** (most cards), **boons** (a minority — the wander deck's old role), and **modifiers** (a few — short global events that bend rules for one round). |
| **D21** | The **last card** of the track is a single **Boss** card with three printed thresholds: a **Science** threshold (count of completed science cards), an **Economy** threshold (bank gold), and a **Military** threshold (sum of unit strength). Each threshold met → one fewer attack the boss makes. Resolving the boss = **win**. |
| **D22** | Round shape: **chief acts → chief flips track card → flip resolves immediately → non-chief seats mitigate in parallel**. Defense's mitigation is preparing for the *next* card; it can never react to the card that just hit. (User confirmed.) |
| **D23** | Defense's actions, in any order: **buy unit** (from hand to stash spend), **place unit** (onto a building tile), **play tech** (red tech: unit upgrade or track manipulation), **end my turn**. |
| **D24** | Red tech splits into two flavours, both feeding Defense's hand: **unit upgrades** and **track modifiers** (peek next-N, swap card within current phase, downgrade incoming card by one phase tier). |
| **D25** | The **`settlementsJoined` win condition is retired**. The win condition is "Boss card resolved." Time-up (track exhausted *without* boss resolution) is "didn't win, score recorded" — same shape as today's turnCap. |
| **D26** | **No fail mode** is preserved. Pressure manifests as building damage, stash drain, slowed yield. The track always finishes. |
| **D27** | Science gains two new per-turn moves that lean into the role's "school / teaching" identity: (a) **Drill** — spend `science` from stash to mark a chosen unit; that unit's **next fire** deals +1 strength. One drill marker per round, consumed on use. (b) **Teach a skill** — spend a larger `science` from stash to permanently grant a chosen unit a skill from a content-driven pool: extend range, +1 maxHP, +1 regen, +1 strength, first-strike, or other skills introduced over time. Once per round, durable. Both moves cost from the science seat's own stash, target a unit on the village grid, and dispatch through a new `scienceCounsel` / `scienceTeach` move pair. |

---

## 2. The center tile (D2–D4)

A new fixed cell at coordinate `(0, 0)` on the domestic grid.

- Always present from setup. Free-form domestic placements continue
  to happen around it; the existing adjacency rule means the first
  *real* domestic building must be orthogonally adjacent to center.
- The center is **never destroyed**. It has no HP track.
- Threats that reach the center burn resources from the **logical
  pool** of every non-chief seat's stash. Pooling math:

  ```
  burn = min(threat.strength, totalStash)
  for i = 1 to burn:
    pick a random seat (uniform from non-chief seats with stash > 0)
    pick a random resource type from that seat's stash (uniform from
    types with >0 of them)
    decrement by 1
  ```

  Spreads damage roughly evenly while staying random over types and
  seats. (This is what the user described as "random but even
  split.")
- A center hit appends a **`bankLog`** entry of kind `"centerBurn"`
  so the chief panel's audit can show "round 14: 3 stone + 1 wood
  burned to a Cyclone."
- The center is **not** the bank. Bank stays under chief
  jurisdiction. Center burns specifically *non-chief stash*.

---

## 3. Threat targeting (D5–D7)

```
1. Threat card flips. It declares (direction D, offset O, strength S,
   note N, optional reward R).
2. The path is the line of tiles starting at the edge of the grid in
   direction D, column/row offset O, walking toward center.
3. Walk along the path until you reach a tile that is either occupied
   (by a building, possibly with units stacked) or is the center
   tile.
4. That is the threat's first impact tile.
5. Every unit in the village whose range (Chebyshev radius) covers
   any tile along the path between the threat's entry point and its
   first impact tile gets a single fire opportunity at strength S.
6. Resolve fires (see §4). Subtract dealt damage from S.
7. If S > 0, apply S damage to the impact tile.
8. If S still > 0 after the building absorbs to its HP floor, the
   threat continues on the same path, looking for the next tile.
9. Repeat 5–8 until S = 0 or path reaches center.
10. If center is reached with S > 0, S resources burn from the
    logical center pool (D3).
```

**Edge cases.**
- A **boon** card just resolves its effect; the path math doesn't
  run.
- A **modifier** card pushes a one-round modifier onto a stack and
  ends.
- An **empty path** (no buildings between edge and center, no center
  hit possible because… wait, center is always present) — collapses
  to: threat reaches center, S burns the pool. With the center tile
  always present, paths always terminate.

---

## 4. Combat math (D8–D10, D13)

Per fire opportunity, a unit deals:

```
damage = unit.strength
       + sum of printed bonuses that match the threat's keyword text
         (e.g. "vs Cavalry +1" applies if threat.note contains "Cavalry")
       − sum of printed enemy resistances
       (clamp at 0)
```

**First-strike ordering** when the impact tile has multiple firing
units: process **first-strike** units before non-first-strike. Within
a tier, fire by placement order. Damage applied is integer, single
swing, no follow-up.

**Unit damage on repel.** When a threat *survives* a unit's fire (i.e.
strength > 0 still), units that fired absorb 1 HP each. Down to 0 HP
= killed. (User's rule: "units lose hp if they repel an enemy and
don't die.") Killed units are removed from their tile. Surviving
units regenerate `unit.regen` HP at end of round (capped at maxHp).

**Stack consumption order (D13).** When the impact tile has a
building with several units stacked, *and* the threat broke through
firing, the **threat's leftover damage** goes through the stack
**bottom-up by placement order** before reaching the building. UI
shows newer placements visually higher in the stack so first-in =
visually-bottom. Each unit absorbs up to its current HP, then dies.
Whatever's left after the stack is the damage the building takes.

```
Example:
  Tile holds (placed first → last): [A:hp1, B:hp2, C:hp4]
  Threat with strength 5 reaches the tile after firing has reduced
  it to S=4 leftover.
  A absorbs 1, dies. S=3.
  B absorbs 2, dies. S=1.
  C absorbs 1, survives at hp3. S=0.
  Building takes 0 damage this round.
```

This satisfies the user's "first in, first hurt/killed" rule. The UI
just paints the stack bottom-to-top in placement order.

---

## 5. The Global Event Track (D19–D21)

Structural shape:

- **10 phases**. Each phase is a small content pile (3–4 cards). At
  setup, each phase pile is shuffled independently, and the track is
  built by concatenating the shuffled piles in order.
- **Telegraphing.** The next card on the track is always **face-up**
  before its turn to flip. Defense sees what's coming this round on
  the previous round; it can prep accordingly.
- **Phase difficulty.** Each phase pile's cards have higher strengths
  / nastier modifiers than the previous phase. This is content-driven
  and lives in `src/data/trackCards.json` (new file).
- **Card mix per phase**: roughly 60% threats / 25% boons / 15%
  modifiers. Phase 10 is the boss alone (no boons / modifiers).
- **Tech-driven track shaping.** Red track-modifier techs let
  Defense:
  - **Peek** the next M cards.
  - **Swap** a card with another from the same phase pile.
  - **Demote** the next card to a phase-(N−1) card from the
    discard pile.
  These satisfy D24.

The **Boss** card (D21) is unique. It prints:

```
BOSS — The Last Settlement
SCIENCE threshold: 6 (completed science cards)
ECONOMY threshold: 12 (bank gold)
MILITARY threshold: 8 (sum of unit.strength on grid)

Each threshold met → −1 attack at resolution.
Boss makes BASE_ATTACKS = 4 attacks.
Each unmet threshold → +1 attack (so 0 thresholds = 8 attacks; 3
thresholds = 1 attack).

Each attack: roll the next track card off a small "boss pattern"
sub-deck (strengths printed in the boss's content). All boss
attacks resolve in sequence in the same round, all on the round
the boss flips.
```

When the boss's attacks resolve and the village survives — **win**.
If the village can't reach the boss (track exhausted but boss never
flipped, e.g. due to ill-defined edge case), it's a "didn't win,
record score" outcome.

---

## 6. Round shape (D22)

Updated from the current round (`Rules.md` §5):

```
ROUND BEGINS

1. Chief phase begins
   1.1 Bank receives chief stipend.
   1.2 Each non-chief seat's `out` swept into bank.
   1.3 Chief acts: distribute, place workers, play 1 gold event.
   1.4 Chief ends phase.
       - `In` drains to `Stash` per current rule.

2. Track flip (NEW)
   2.1 Chief flips the next track card (a one-line move:
       `chiefFlipTrack`).
   2.2 Card resolves *immediately*:
       - boon → its effect dispatches via the existing event-effect
         system.
       - modifier → pushed onto a one-round modifier stack.
       - threat → run the path / fire / impact algorithm in §3 + §4.
   2.3 Resulting damage is applied: building HP decreases, unit HP
       decreases, killed units removed, center burns posted to
       bankLog.
   2.4 The *next* track card is flipped face-up to telegraph.

3. Others phase begins
   3.1 Each non-chief seat's stage activates in parallel.
   3.2 Each seat's auto-housekeeping runs:
       - domestic auto-produce (yields prorated by current building
         damage).
       - defense gains regen on all alive units.
   3.3 Seats act:
       - science: as today.
       - domestic: buy / place / upgrade / **repair** (D17).
       - defense: buy / place / play tech (D23). No flip, no upkeep.
   3.4 Each seat ends its turn.

4. End-of-round
   4.1 Per-round flags reset.
   4.2 Round counter increments.

ROUND ENDS
```

Defense is structurally **one round behind** the threat — they see
what hit and prepare for the next. The face-up next-card mechanic
gives them concrete information to plan against.

---

## 7. Domestic delta (D15–D18)

State changes:

- `DomesticBuilding` gains `hp: number` and `maxHp: number`. `maxHp`
  is read from `buildings.json` per def — not derived. (User wants
  "tied to cost, not 1:1.")
- `BuildingDef` gains `maxHp: number` field (1–4). It does **not**
  gain a `unitBonuses` field — placement bonuses are authored on the
  unit instead (D18).

Move changes:

- New: `domesticRepair(cellKey, amount)`. Pays `⌈cost × amount/maxHp⌉`
  from stash, restores up to `amount` HP capped at `maxHp − hp`.
- `domesticBuy` unchanged in shape. Cost, hand, placement rules
  unchanged.
- `domesticUpgrade` unchanged for now. Could later raise a building's
  `maxHp` or its unit-bonus stack — content question, not
  mechanical.

Production:

- `produce.ts` reads `damagePct = (maxHp − hp) / maxHp` and reduces
  the building's contribution by `⌈yield × damagePct⌉` (per slot, per
  resource).

Buildings whose old job was "discount foreign" (Walls / Tower /
Forge):

- **Tower** — high `maxHp`. Units that *want* the Tower will say so
  on their own card (e.g. "Watchman: +1 range on Tower").
- **Walls** — high `maxHp` baked in. No active unit bonus from
  Walls itself; certain units may print "+1 first-strike on Walls."
- **Forge** — moderate `maxHp`. Units that pair with it print
  "+1 strength on Forge."

The combat resolver reads each unit's `placementBonus[]` at fire
time and checks the `defID` of the building underneath the unit's
tile. Buildings carry no defensive metadata beyond `maxHp` and the
existing yield content. This is the D18 model: bonuses lean into
the **defense** player's content, not domestic's.

---

## 8. Chief delta (small)

- New move: `chiefFlipTrack()`. Single-line move, dispatches
  immediately into the resolve algorithm. **No decision content** —
  it's the table-presence beat the user asked for.
- `chiefDistribute` is unchanged; it just gets more weighty (the
  village leans on Defense's stash).
- `chiefDecideTradeDiscard` is **deleted** (D14: trade requests are
  gone).

---

## 8a. Science delta (D27 — "school / teaching")

Two new per-turn moves, both authored as "the science seat
contributes their own stash to the village's defense." They lean
into the role's school / teaching identity, and they live alongside
(don't replace) the existing science contribute / complete loop.

### Drill — `scienceDrill(unitInstanceID)`

- Pay a small `science` cost from the science seat's stash.
- Pick one unit currently on the grid.
- Mark it with a one-shot **drill token**: its next fire deals
  `+1 strength`.
- The token is consumed at fire time; if the unit dies before
  firing, the token is lost.
- **Once per round.** Cleared at end-of-round if unused.

### Teach — `scienceTeach(unitInstanceID, skillID)`

- Pay a larger `science` cost from the science seat's stash. (Cost
  could also vary per skill; default to a flat cost in V1.)
- Pick one unit currently on the grid.
- Pick one skill from the content-driven `SKILLS` pool. V1 skills
  (small, hand-authored, expandable):
  - `extendRange` — `unit.range += 1`
  - `reinforce` — `unit.maxHp += 1` (current hp also +1)
  - `accelerate` — `unit.regen += 1`
  - `sharpen` — `unit.strength += 1`
  - `firstStrike` — `unit.firstStrike = true`
- The skill is **durable**: it stays with that specific unit
  instance for the rest of the game (until the unit dies).
- **Once per round.**

### Why these are small but real adds

- Both target an existing unit (no new placement state).
- Drill leans on a single transient marker; Teach mutates a unit
  instance's stat fields.
- Both feed naturally into the **chief → flip/resolve → others
  mitigate** round shape: science Teach/Drill happens during the
  others phase, *after* the threat has hit, in time for the next
  round's telegraphed card.
- Both stay clear of the bigger science redesign queued for later:
  they don't touch the science card grid, the under-card tech
  distribution, or the contribute/complete loop. If the future
  redesign retires Drill/Teach, scars are minimal — two moves and
  a small skills table.

### State / type additions

```ts
// G.defense.inPlay[i] gains:
{
  ...
  drillToken?: boolean;          // consumed on next fire
  taughtSkills?: string[];       // skill IDs accumulated
}

// new content table:
// src/game/roles/science/skills.ts → SKILLS: Record<SkillID, SkillDef>
```

The combat resolver applies `taughtSkills` to the unit's effective
stats at fire time (range, strength, etc.) and consumes
`drillToken` if set.

---

## 9. Defense's full state and move list (D23–D24)

```ts
// G.defense
{
  hand: UnitDef[];           // unit cards available to buy
  techHand?: TechnologyDef[]; // red tech cards distributed by science
  inPlay: Array<{
    cellKey: string;          // building tile (must match a placed
                              // domestic building tile)
    defID: string;            // unit name
    hp: number;
    placedAt: number;          // round number; ties broken by an
                               // append index so first-in-first-killed
                               // is unambiguous
  }>;
}
```

Moves:

- `defenseBuy(unitDefID)` — pay `cost` from stash, push `unitDefID`
  into a "bought but not placed" pile, OR (simpler) **buy + place
  in one move**: `defenseBuyAndPlace(unitDefID, cellKey)`. I'd ship
  the latter to keep the move count low.
- `defensePlay(techDefID, args)` — apply a red tech: a unit upgrade
  attaches to a tile, a track-modifier mutates the next-N cards.
- `defenseSeatDone()` — end my turn (no upkeep gate; user removed
  upkeep entirely).

Removed from the previous foreign role:

- `foreignUpkeep`, `foreignRecruit` (folded into `defenseBuyAndPlace`),
  `foreignReleaseUnit`, `foreignFlipBattle`, `foreignFlipTrade`,
  `foreignAssignDamage`, `foreignTradeFulfill`, `foreignUndoRelease`.
- The `BattleInFlight` slot, `_upkeepPaid`, `lastBattleOutcome`,
  `pendingTribute`, the entire battle resolver
  (`battleResolver.ts`), the trade deck, `tradeRequest`, etc.

Whole files deletable:
`battleResolver.ts`, `release.ts`, `flip.ts`, `assignDamage.ts`,
`tradeFulfill.ts`, `tradeRequest.ts`, `upkeep.ts`,
`undoRelease.ts`, `playRedEvent.ts` (folded into the generic event
dispatcher if needed). `decks.ts` is rewritten as a track-card deck
loader.

---

## 10. UI requirements (called out because user asked for visibility)

These are not "nice to have" — they're load-bearing.

1. **Track strip.** A horizontal strip showing past cards (greyed
   out), the *current* card (just flipped), and the *next* card
   (face-up telegraph). Phase markers visible above it.
2. **Stack visualization.** When a tile holds multiple units, show
   them as a vertical stack with the **first-placed unit visibly at
   the bottom** (D13). When a unit dies, the bottom-most pops off.
   Use placement-order numbers if the visual stack gets ambiguous.
3. **Path overlay on flip.** When a threat resolves, briefly
   highlight its path from edge to impact tile so the table can read
   "what just happened." A single short animation pulse is enough.
4. **Building damage indicator.** A small HP bar / pip row on each
   building tile. 1–4 pips, fill = current hp. Damage flash when
   hit. Repair flash when domestic repairs.
5. **Center-burn announcement.** When a center hit happens, a small
   floating banner in the center mat saying "−2 wood, −1 stone (3
   total) burned." Auditable in `bankLog` after the fact.
6. **Threshold readouts on the boss card.** When the boss is in
   the next-card slot, the UI shows the village's current Science /
   Economy / Military totals next to the boss's required numbers
   so the table knows where they stand.

---

## 11. Things to update in the documentation

- `docs/Rules.md` — major rewrite of §5.2.3 (foreign), §5.3 (combat
  resolver), §5.2.4 (trade-request), §5.4 (end-of-round), §6 (win
  condition). New §5.4-ish on the track + flip moment.
- `docs/game-design.md` — §3.4 ("Foreign — current") gets retired
  and replaced with the new Defense spec; §3.5 (opponent / wander)
  is folded into the track section; §1 (the bet) gets a one-line
  acknowledgement of the genre tilt.
- `CLAUDE.md` — the project-stance bullets about "build an army
  from cards" stay (still true). The "battle deck, trade deck, MTG
  combat" references in the layout / file listing get updated when
  the code lands.

---

## 12. Things still to design (small tunables, after spec lands)

These don't block prototyping; they get filled in during paper play.

- **Number of phases / cards per phase.** Default 10×3 = 30. Could be
  10×4. Don't go above 10×4 — game length tax.
- **Boss thresholds.** Concrete numbers for Science / Economy /
  Military. These come from playtest; spec leaves them as content.
- **Boon / modifier mix.** 25/15 split is a guess.
- **Building HP per def.** Each building needs a `maxHp` printed.
  Suggested: shacks 1, mid-tier 2, big buildings 3, fortifications 4.
- **Range numbers per unit.** Most units range 1–2. A few specialists
  range 3 with limited strength. Concrete numbers come with content.
- **Stack soft-cap?** V1 is uncapped. If "stack 8 archers on the Tower
  next to center" emerges as the dominant strategy, add a cap.
- **Defense's starting hand.** Today it's 3 starter Militia. Likely
  unchanged.

---

## 13. Suggested implementation order (for the next sub-plan)

1. **Content schema**: extend `BuildingDef` with `maxHp` +
   `unitBonuses`; extend `UnitDef` with `range`, `regen`, `firstStrike`
   (boolean), and rename `defense` → `hp` for clarity. New
   `TrackCardDef` schema. Ship `trackCards.json` with placeholder
   content covering all 10 phases.
2. **Center tile**: pre-seed `(0, 0)` with a `centerTile` marker in
   `setup.ts`; teach `isPlacementLegal` that center is always a
   neighbour for adjacency.
3. **Building HP + repair**: extend `DomesticBuilding` state, add
   `domesticRepair`, prorate `produce.ts`.
4. **Retire the old foreign loop**: delete the move files listed in
   §9; remove `BattleInFlight`, `tradeRequest`, the battle deck and
   trade deck. Update `playerView`, `endConditions`, types.
5. **Track plumbing**: track state on `G`, `chiefFlipTrack` move,
   resolve algorithm (§3 + §4), event-effect dispatch for boons.
6. **Defense moves**: `defenseBuyAndPlace`, `defensePlay`,
   `defenseSeatDone`. ai.enumerate skeleton for bots.
7. **Win condition**: `endConditions.ts` flips from
   `settlementsJoined >= 10` to "boss resolved."
8. **UI**: track strip, stack visualization, path overlay, HP pips,
   center-burn banner, boss threshold readouts, drill / teach
   indicators on units.
9. **Science Drill + Teach** (D27): `scienceDrill`, `scienceTeach`,
   `SKILLS` content table, resolver integration for taught stats.

Do not try to land all nine as a single sub-plan. They want to be
**3 sub-plans**: (1) content schema + center tile + building HP +
retire old foreign, (2) track + defense moves + science Drill/Teach
+ win condition, (3) UI.

---

## 14. Risk recap (carried forward from the previous report)

These are still live. Note the ones that the locked decisions resolve
or mitigate.

- **W1 ramp problem** — *resolved* by D2/D3 (center tile is always
  there).
- **W2 mega-tile** — *partially mitigated* by D11 (uncapped stacks,
  but no stack-amplifying bonuses, per user's "stack does not
  amplify"). Each unit fires independently. Watch in playtest;
  add a soft cap if needed.
- **W3 analysis paralysis** — *partially mitigated* by D19
  (telegraphed next card means you can plan during the *previous*
  round, not freeze when the card flips).
- **W4 domestic dilution** — *user said don't worry*.
- **W5 track variance** — *mitigated* by D19 (phase piles + face-up
  telegraph).
- **W6 game length** — *partially settled* by D19 (10 phases ×
  ~3 cards ≈ 30 rounds). Watch for round-time creep.
- **W7 table HP markers** — *mitigated* by D15 (cap at 4, so cubes
  or pips are practical).
- **W8 opaque math** — *still live*. UI must show stack order,
  fire order, and damage breakdown. See §10.
- **W9 cards-as-dice** — *acknowledged*. The track is the
  randomization source.
- **W10 bot complexity** — *still live but tractable*. The bot now
  needs a positional placement heuristic.

---

## Quick narrative — what the game feels like now

> Round 14. The track shows we're in phase 4. The face-up next card
> is **"Cavalry Raid — N, +1, strength 6, +2 vs Spear."** Defense
> already saw it last round and convinced chief to send extra gold.
> This round, chief flips the *current* card — **"Wandering Trader,"
> a boon: +3 wood to bank.** Sigh of relief. Domestic produces:
> Forge yields 2 (it's at 4/4 hp), Mill yields 1 (it's at 2/3 hp,
> down a third). Defense buys a Spearman (no, an Axeman — the
> incoming Cavalry is +2 vs Spear) and stacks it on the Tower at
> column +1 north. Domestic repairs the Mill back to full. Science
> contributes toward the next blue card. Round ends. Chief's next
> card flip is the Cavalry Raid we've been preparing for.

That's the loop the spec produces.
