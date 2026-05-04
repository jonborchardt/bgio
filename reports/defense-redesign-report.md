# Defense redesign — analysis, options, and warnings

**Date:** 2026-05-03
**Predecessor:** [foreign-mini-game-ideas.md](./foreign-mini-game-ideas.md)
**Status:** narrowing — the user has made structural decisions; this
report stress-tests them, surfaces choices that still need to be made,
and flags risks before any of it lands in code or in
`docs/game-design.md` §3.4.

---

## Read first — questions I need answered to narrow further

I made best-guess assumptions for everything below, but a few of these
*meaningfully* change the recommendation. Listed in order of how much
they affect the rest of the report:

1. **What does the village's geometry look like?** Today the domestic
   grid is purely topological — Manhattan-1 adjacency, but no "edge,"
   no rows, no compass. Range and "where is the threat coming from?"
   only mean something on a grid with structure. Three credible
   shapes:

   - **(a) Compass village.** Bounded grid (say 5×5 max). Each side is
     a labelled edge — N / E / S / W. Threat cards print an edge icon;
     threat enters at that edge, marches toward the center.
   - **(b) Lane village.** Fixed-width grid (say 4 columns), unbounded
     height. Threat cards print a column 1–4. Threats march down their
     column. Closest in spirit to *Galaxy Trucker* asteroids.
   - **(c) Outer ring.** The current free-form grid stays, but a
     border ring of "frontier" tiles surrounds it. Threat cards land
     somewhere on the ring and burrow inward toward an adjacent
     building.

   I default to **(b) Lane village** for the rest of the report — it
   maps cleanest onto the user's "asteroids in Galaxy Trucker"
   reference, is the easiest to bot, and keeps the grid simple. **If
   you want compass-edge or outer-ring instead, several downstream
   pieces flip.**

2. **Do threats march, or strike instantly?** The user's "asteroids"
   reference suggests instant — Galaxy Trucker asteroids resolve the
   turn they appear. But "units have range typically > 1" only matters
   if threats spend ≥ 1 turn in transit. Two readings:

   - **(i) Instant.** Card flips, threat appears at lane row 0 with
     strength S; every unit whose range covers row 0 in that lane
     fires once; remainders hit the building. One-and-done per turn.
   - **(ii) March.** Threat appears at the far end of the lane with
     speed M (cells/round). Each round it advances M; every unit in
     range fires; if it reaches an occupied building, it hits it.

   I default to **(ii) March, with most threats at speed 1**, because
   it's what makes range a meaningful design lever. Instant works too
   but flattens range from a tactic to a binary "in-range or not."

3. **What's the win condition's *final* card?** "Complete the last
   global event" can mean either (a) survive to the end of the track
   = win, or (b) the last card is a Boss-like encounter that has to
   be decisively beaten. (b) implies you can run out the track and
   *not win* (timeout). The user's stance is no fail mode — so (b)
   would still resolve "didn't win, score recorded, try again." I
   default to **(b) Boss card at end of track**, with timeout =
   "didn't win" (current "time up" behavior).

4. **Building HP — fixed or cost-scaled?** I default to **cost-scaled
   with a floor**: HP = max(3, build cost). A 6-cost Forge has 6 HP;
   a 1-cost shack has 3.

5. **Stash burn — does it survive this redesign?** In the previous
   report you endorsed it as a failure cost. With buildings now
   absorbing the failure (HP loss), is stash burn redundant or
   complementary? I default to **complementary but rare**: a small
   subset of track cards (the "raid" type) explicitly burn stash,
   alongside the threats that hit buildings. Without it, hoarding
   becomes safe again.

The rest of the report runs with the defaults above. Anywhere a choice
flips a meaningful piece, I call it out.

---

## What you've decided, parsed and acknowledged

Numbered to mirror your message; my one-line reading after each.

1. **Rename foreign → Defense.** Role identity becomes "defend the
   village." All UI / code / docs follow.
2. **Defense buys + places units on the village** *on a space*, not
   *taking* a space. Units **stack** on tiles; per #18, those tiles
   must hold a domestic building.
3. **Global event track**, ~30–40 cards, visible to all, runs the
   length of the game. Mostly threats, some boons. **One card per
   round.**
4. **Defense's tech cards** alter the track or upgrade units.
5. **Each track threat** prints: origin (lane/edge), strength,
   special rules (e.g. "weak to fire"). Diceless, fully card-driven.
6. **Threats past defenses** damage buildings.
6b. **Buildings have HP.** No full destruction. % HP lost = % yield
    not produced (rounded up).
7. **Domestic repairs** at cost = ⌈build cost × damage%⌉.
8. **Win** = complete the last global event. Track is segmented into
   ~10 phases; cards inside a phase are random; phase-N cards are
   harder than phase-(N−1).
9. **Setup**: no buildings start protected (i.e. no starter unit on
   the grid).
10. **Range & range-shape stats on units.** Pure-math auto-defense in
    range; some units differentiate by enemy type or shape.
11. **Units immobile** once placed.
12. **No upkeep.**
13. **Battle deck and trade-request slot removed.**
14. **No offensive Defense** mode — purely defensive.
15. **Chief flips track card.** Round shape: chief acts → flip →
    everyone watches → others react.
16. **Units take HP damage** when they repel a threat without killing
    it; HP regenerates per turn; some units / nearby buildings boost
    regen.
16b. **Nearby buildings affect units, and vice-versa.**
17. **Units don't block domestic placement** (units are *on* a tile,
    not *in* it).
18. **Units must sit on a domestic building.** Stacking allowed only
    on a placed building card.
19. **Small changes to domestic / chief OK; big science change is
    coming.** I'll keep the science footprint of this redesign minimal
    so it composes with the future science work.

---

## Where this lands the game (impact analysis)

### Genre shift

You are turning a **co-op card civ** into a **co-op tower-defense
civ**. That's not a tweak. The closest commercial reference points:
*Castle Panic* (the cooperative archetype), *Galaxy Trucker* (asteroid
deck = your event track), *Spirit Island* (invader track + power
cards), *Mage Knight*'s tower-defense cousin. None of these are bad
neighbours, but it's worth saying out loud — the game's spiritual
ancestry is changing, and `docs/game-design.md` §1 ("the bet")
should be updated to reflect it. The "four mini-games, one per role"
premise survives; the *type* of mini-game Defense plays changes.

### Pacing

- **Round count drops.** Today the cap is 80 rounds with no terminal
  pressure. The track now imposes ~30–40 rounds with terminal
  pressure. That's *shorter* and *more shaped*. Probably good for
  feel; means the existing 80-round timeout is dead.
- **Per-round wall-time should improve.** Defense's per-round play
  becomes "buy/place unit, optionally play tech." Combat math is
  automatic. This is **faster** than the current
  recruit-flip-allocate flow, and aligns with the speed constraint
  from the previous report.
- **Round shape shifts.** Today: chief → others (parallel) →
  end-of-round (wander). Proposed: chief → **flip track card** →
  others (parallel) → end-of-round (track resolves, building damage
  applies). The flip becomes a mid-round table moment.

### Domestic's identity (modest but real shift)

- The grid stops being purely a yield-puzzle and starts being a
  literal map of the village under attack. Adjacency yields still
  matter; on top of that, **placement geometry** now matters
  defensively (which tiles get attacked first, where towers can sit,
  how lanes cluster).
- Domestic acquires a **repair** action and a **building HP** state.
  That's a meaningful addition, but it slots cleanly under the
  existing "buy / upgrade" action set.
- The "**Range × stack**" interaction (point 16b) means domestic
  buildings can now **boost units**: a Tower could give +1 range or
  +1 regen to units stacked on it. This is an organic place to
  retire the old "Walls / Tower / Forge → −X cost on foreign units"
  modifiers, which now don't exist (no upkeep, no recruit cost
  bonus). Replace with positional bonuses.

### Chief's identity (small additive change)

- Chief flips the track card and narrates it for the table. That's a
  ceremonial move — almost zero decision content — but a real
  table-presence beat.
- The **distribute** action gets more weight, because Defense now
  spends visibly to keep the village standing. Distributing to
  Defense becomes "fund the wall" instead of "fund whatever foreign
  is doing this round."
- Possible **chief growth knob** (optional): chief can spend a worker
  to drop an emergency *fortification* token on a building (e.g. +2
  HP this round). Small, doesn't bloat the role.

### Science (deferred — pending the big science redesign)

- Red tech is now upgrade-units-or-modify-the-track tech. That fits
  the existing scienceComplete distribution by color. No change to
  science flow yet.
- **Caution:** if the future science redesign reshapes color
  distribution, make sure red still feeds Defense — losing tech-flow
  to defense would gut a role that now depends on it.
- One small ask of the science redesign: leave room for Defense's red
  tech to come in two flavours — *unit upgrades* and *track
  modifiers* — because both will exist and a single tech-card pool
  needs to support both shapes.

### Settlements / win condition

- The trade-requests are gone (#13). The win condition shifts from
  `settlementsJoined >= 10` to **completing the final track card**.
- `endConditions.ts` simplifies — there's still no fail mode; the
  win condition is now binary (final card resolved → win).
- A score (for "time up" or for replay variance) can still be
  recorded. Reasonable score components: rounds remaining, total
  HP retained across buildings, units alive, repairs not needed.

---

## A typical round, walked through

To make the redesign concrete:

1. **Chief phase begins.** Bank gets stipend; previous round's `out`
   slots sweep into bank.
2. **Chief acts.** Distributes resources, places workers. *(No
   trade-request decision anymore — it's gone.)*
3. **Chief ends phase.** `In` drains to `Stash` per current rule.
4. **Track flip (NEW, ~5–10 sec table moment).** Chief flips the next
   track card. The card prints: lane, distance/speed, strength, HP,
   special rules, optional reward. Card is laid face-up next to the
   track for the round.
   - For "boon" cards, the effect resolves immediately (e.g.
     "village gains +2 wood to bank").
   - For "threat" cards, a token enters the lane at the printed
     start-row.
5. **Others phase begins.** All non-chief seats act in parallel.
   Domestic auto-produces (yields prorated by building damage).
6. **Defense seat acts.** Buys unit cards from hand (paying from
   stash), places them onto buildings (stack allowed). May play
   tech: unit upgrades, range boosts, track manipulations. **No
   battle flip, no trade flip, no allocation.** The seat ends in
   well under a minute.
7. **Domestic seat acts.** Buys / places / upgrades / repairs
   buildings.
8. **Science seat acts.** As today.
9. **Others phase ends.**
10. **End-of-round resolution (UPDATED).**
    - Threats march per their speed.
    - Each unit fires automatically into its range. Damage is pure
      math: `damage = unit.attack` (modified by per-threat
      vulnerabilities).
    - Surviving threats that reach a building deal `threat.strength`
      damage to it. Units stacked on the building absorb first
      (HP-bag style); leftover damage hits the building.
    - Buildings update their `damagePct`.
    - Units regenerate per-round HP.
11. **Wander deck flips.** *(Open question — see "Variants" below.
    The track may eat the wander's role entirely.)*
12. **Round counter increments.**

End of game: when the **last** track card resolves and is fully
cleared (or beaten, if it's a boss), the village wins.

---

## Variants / options for the contentious bits

The user said "give some options." Here are the design switches that
still need a pick.

### Option A — Spawn shape

| Variant | Pros | Cons |
| --- | --- | --- |
| **A1. Lanes (default).** 4 columns, threats march row 0 → row N. | Simple. Maps to GT asteroids. Bot-friendly. Easy to print on cards. | Forces the village to adopt a column layout — domestic placement loses some freedom. |
| **A2. Compass edges.** Bounded grid, threats enter from N/E/S/W edge. | Most thematic — it's a "village under attack." | Requires a fixed grid bound (e.g. 5×5). Defenders near the center are useless. |
| **A3. Outer ring.** Free-form grid plus a border ring; threats land on a ring tile. | Preserves current placement freedom. | Two tile types (interior + border), more concept overhead. |

**Recommendation:** A1 lanes for V1; promote to A2/A3 only if A1 feels
too sterile.

### Option B — Threat motion

| Variant | Pros | Cons |
| --- | --- | --- |
| **B1. March (default).** Threats spend N rounds traversing the lane. | Range becomes a real lever. Multiple turns to react. | More state to track per threat. |
| **B2. Instant strike.** Threats appear and resolve same round. | Tight, simple. Perfect Galaxy Trucker fit. | Range stat collapses to "in or out." Boring after 5 turns. |
| **B3. Hybrid.** Most threats march; a "siege" subtype is instant; a "fast" subtype moves 2/round. | Variety without complexity creep. | Three threat types means more card art / icons. |

**Recommendation:** B3. Speed is just one number on the card; even
players can read it in 1 second.

### Option C — End-of-track

| Variant | Pros | Cons |
| --- | --- | --- |
| **C1. Last card is a Boss.** Boss has lots of HP, multiple incoming attacks. Beat it = win. | Climactic. Memorable. Fits "complete the last event." | Heavier rules near end of game. |
| **C2. Final card is just the last threat.** Survive to it = win. | Simplest. | Ending feels anticlimactic. |
| **C3. Boss is a multi-card mini-arc** (last 3 cards form a sequence). | Most cinematic. | Most rules. |

**Recommendation:** C1. Single Boss card, but with multiple printed
"phases" on it (it acts on 3 successive rounds before resolving).

### Option D — Track scaling

| Variant | Pros | Cons |
| --- | --- | --- |
| **D1. Phase-pile shuffle (default).** Each phase has its own pile of cards (≈3–4 each); shuffle the pile, deal that many, advance. Phase pile N has higher-strength cards than N−1. | Predictable variance per phase, bounded surprise. | Track length is fixed (10 phases × 4 cards = 40). |
| **D2. Single shuffled deck with ramp marker.** One big deck shuffled at setup; every M cards, a "ramp" marker tells the engine to swap the next-card pool for a tougher one. | Easier to add / remove cards by edit. | Per-game variance is higher; can clump bad rolls. |
| **D3. Player-shaped track.** Defense techs / boons literally insert / remove / replace cards in the track. | Best agency. Tech cards become deeply meaningful. | Bot logic for "replace card X with card Y" is non-trivial. |

**Recommendation:** D1 for V1, with **D3 as a tech-effect overlay** —
specific Defense techs let you peek the next card or swap it for
another from the same phase.

### Option E — Building HP & damage math

The user proposed `damageDealtPct = (build cost × damage%)` rounded
up; yield-produced is the inverse. Two refinements worth picking:

- **HP starts at = build cost** (with a floor of 3, see "Read first"
  Q4) — a 6-cost Forge takes 6 HP of damage to be fully damaged
  (i.e. yield = 0). Smaller buildings die-yield faster.
- **Yield prorating uses ceiling for damage** so even 1 HP off
  meaningfully hurts. Concretely: building with HP 6, current HP 3
  → damage% = 50% → yield = ⌊yield × (1 − 0.5)⌋ = half. With
  ceiling-of-loss: lose ⌈yield × 0.5⌉ = more aggressive.

The user wrote both "rounded up" and "(or something)." I default to
**"lose ⌈yield × damage%⌉"**, which is the more punishing reading
and matches the "make damage hurt visibly" vibe.

### Option F — Track flip timing

| Variant | Pros | Cons |
| --- | --- | --- |
| **F1. Mid-round flip (user's preference).** Chief acts → flip → others react → resolve at end. | Defense and domestic can react before the resolve. Highest tension. | Round structure has 4 beats instead of 3. |
| **F2. Start-of-round flip.** Card flips before chief acts. Chief sees it; distributes accordingly. | Chief gets to react too. | Defense is the role under pressure, not chief. Chief shouldn't be the one strategizing. |
| **F3. End-of-round flip.** Card flips after others; resolves immediately; previous round's prep faces this round's attack. | Removes "I see it, then I buy it" perfect play. | Defense plays blind, which can feel unfair. |

**Recommendation:** F1, the user's pick. It's the most theatrical and
gives Defense the cleanest beat: see, then act.

### Option G — Wander deck (the existing pressure system)

The track now plays the wander deck's role. Three options:

- **G1. Retire the wander deck.** Track is the only pressure source.
- **G2. Wander stays, smaller pool.** Wander now flips at a lower
  cadence (every other round) and only does *boons* and *minor
  shocks*. Track does threats.
- **G3. Wander folds into the track.** Boon cards in the track *are*
  the wander cards. One deck.

**Recommendation:** G3. The user said "global events" replace the
"existing global events that happen 1× a turn" — that *is* the
wander deck. Folding them into one track is the cleanest read.

---

## Concrete changes to domestic (small)

1. **Building HP** as new state: `DomesticBuilding.hp: number` and
   `maxHp: number`. Default `maxHp = max(3, def.cost)` at placement.
2. **Repair move**: `domesticRepair(cellKey, amount)` pays
   `⌈cost × amount/maxHp⌉` from stash to restore `amount` HP.
   No INVALID_MOVE on partial — repair what you can afford.
3. **Production prorate**: `produce.ts` reads `damagePct = (maxHp −
   hp) / maxHp` and reduces the cell's contribution by ⌈yield ×
   damagePct⌉.
4. **Adjacency rules unchanged.** Existing yield bonuses still apply.
   Add a *new family* of adjacency rules: "+1 unit regen to units
   stacked on a Tower" — these live in the same content table.
5. **Walls / Tower / Forge** lose their unit-cost / unit-upkeep
   modifiers (those mechanics are gone) and gain positional defense
   bonuses (e.g. Walls: "+1 HP to building's max HP"; Tower: "units
   stacked here gain +1 range"). Same content slot, different
   semantics.

## Concrete changes to chief (smaller)

1. **Chief flips the track** at the chief→others boundary. New move:
   `chiefFlipTrack()`. It's a one-line move; the card's content
   resolves through the existing event-effect dispatcher.
2. **Optional: emergency fortification.** Chief can spend a worker
   token from reserve to add +2 HP to a single building this round.
   Small new move, optional. Don't ship in V1 unless playtest demands
   it — the role doesn't need padding right now.
3. **Distribute is unchanged.** It just becomes more obviously
   directional ("the wall needs gold").

## Defense's new shape (concrete)

| Action | What it does |
| --- | --- |
| **Buy unit** | Spend stash to take a unit card from hand. |
| **Place unit** | Put a bought unit on a building (any owned). Stacking allowed. Once placed, immobile. |
| **Play tech** | Apply a red tech card: upgrade a unit, alter the next track card, swap a track card, etc. |
| **End my turn** | (Auto-eligible — there's no upkeep gate anymore.) |

**No** recruit / upkeep / battle-flip / trade-flip / allocate /
release / undo-release moves. The whole `BattleInFlight` slot
disappears. `release.ts`, `flip.ts`, `assignDamage.ts`,
`tradeFulfill.ts`, `tradeRequest.ts`, `upkeep.ts`,
`undoRelease.ts`, and `battleResolver.ts` are deleted or rewritten.

---

## Warnings — where this can go wrong

These are the failure modes I'd want to playtest against early. Each
one would derail the redesign if missed.

### W1. **The "Defense ramp" problem.**

Per #18 + #9, no buildings = no unit placement = no defense. Round 1,
the village has zero buildings and the first track card flips. If
that card is a real threat, it goes straight at… nothing? *Or* the
village's "edge" itself takes damage?

Three credible fixes:

- **Hardcoded grace period:** the first 2–3 track cards are boons or
  no-ops. Phase 1 of the track is "tutorial."
- **Starter building:** every match starts with one placed building
  (e.g. a "Town Center" that costs nothing and seeds the grid).
  Already partially supported by the current setup which gives
  domestic a starter hand.
- **Threats target whatever's there:** an empty grid has nothing to
  damage; the threat scores a "free pass" that costs the bank
  resources or burns a chief worker. Mechanically clean but
  slightly thematic-uncanny.

Recommend **hardcoded grace period + starter Town Center** as belt +
suspenders.

### W2. **Range × stacking → one mega-tile.**

If units stack freely and one Tower gives +1 range to everything on
it, the optimal play is "build a Tower in the middle, stack five
units on it, defend the whole map." Counterforce options:

- **Stacking limit:** ≤ N units per building (N tied to building
  size or upgrade count).
- **Diminishing range bonuses:** Tower gives +1 range to one unit on
  it, not all.
- **Lane-locked units:** units only fire into the lane their
  building sits in.

Pick at least one. I'd recommend **lane-locked + soft stack cap (3
units / building, raised by upgrades)**.

### W3. **Pure-math combat → optimal play is solvable.**

Without dice or hidden information, every encounter has a *correct*
answer that a determined player can compute. That's fine for V1, but
two failure modes to watch for:

- **AP (analysis paralysis):** the smart player sees the puzzle and
  optimizes for 5 minutes per round.
- **Boredom:** once you've internalized the optimal strategy, every
  round is mechanical.

Mitigations: **track variance** (cards inside a phase are
shuffled — you see *what* phase you're in but not *which* card flips
next); **constrained budget** (you rarely have enough resources to
field the optimal counter); **track modification techs** that let you
substitute and so reshape the puzzle.

This risk is real but manageable. Logging it because it's the
inevitable trade-off of "no dice, no hidden info, deterministic
combat."

### W4. **Domestic identity dilution.**

Domestic now has: yield buildings + adjacency bonuses + HP + repair
+ defensive bonuses to units. That's a lot. The role can absorb it
because it's already the most "tableau-management" of the four, but
watch for:

- **Repair move bloat.** If repair becomes the dominant domestic
  action, the role's identity narrows to "fix things." Tune the
  repair cost so it's a fallback, not the default — i.e. building
  forward is usually still the better spend than repairing, except
  when a key yield cell is critically damaged.
- **Adjacency being eaten by defense.** If every domestic decision
  is "where best to defend?" rather than "where best to yield?",
  the original Carcassonne-shape of domestic disappears. Solve by
  **keeping the yield/adjacency value strong enough that pure
  defensive layout always sacrifices yield.**

### W5. **Track variance can swing a run.**

If phase 3's pile contains one card that nukes lane 2, and you draw
it the round you have nothing in lane 2, that's a feel-bad spike.
Mitigations:

- **Phase piles ≥ 6 cards** so any single nasty card is rare.
- **Track-modifier techs** so Defense can react to bad luck.
- **Telegraphed cards:** the *next* card in the track is face-up;
  you only see the *one* coming. Still random, but you get one
  round to prep.

I lean toward **face-up next card** as a baseline. It costs nothing
to print and resolves a lot of feel-bad.

### W6. **Game length must be tuned together with track length.**

Round-pacing budget: ~30–40 rounds × ~3–5 minutes/round ≈ 90–200
minutes. That's potentially a long session. Four levers:

- Shorten the track (10 phases × 3 cards = 30).
- Speed up rounds (most rounds are "no flip" or trivial).
- Make boon cards skip the others phase (chief flips boon, applies,
  on to next round).
- **Flip multiple cards per round in late phases** to compress.

Don't pick all four. I'd start at 30-card track + a fraction of
boon-only rounds.

### W7. **Tabletop physicality of building HP.**

Buildings now need an HP marker per cell. With a 5×5 grid and HP up
to ~6, that's 25 dials. Online: trivial. At a real table: 25 little
plastic dials. Practical fixes:

- **Damage cubes** instead of dials — drop a cube on a building per
  HP lost; remove cubes on repair.
- **Print a track on each building card** — slide a meeple along.

Either works. Calling out so it's not forgotten when content art
goes.

### W8. **Unit HP regen + nearby-building bonuses → opaque math.**

Once units have HP, regen, regen-modifiers from adjacent buildings,
and damage-from-repelled-attacks, a single tile's per-round
arithmetic can hide. Risk: the *engine* knows the answer but the
*table* doesn't. Counter: print **per-round summaries** on the
table card (and in the UI panel). Keep modifiers to ≤ 2
sources/unit.

### W9. **"Galaxy Trucker without dice" is still random.**

Drawing a card from a shuffled phase pile is functionally equivalent
to rolling a die over the phase's outcome distribution. The user
banned dice; cards-from-a-shuffled-pile are the legal, less-noisy
substitute. This is fine, but worth flagging that the track's
"randomness" is the deliberate stand-in.

### W10. **Bots need to think positionally now.**

Per #4 in the previous report, bots can be coded to whatever; that
constraint was lifted. Defense bot now needs to: enumerate buy
choices, score placements positionally (which lane, which building,
projected damage prevented), and play tech. This is more work than
the old `recruit / flip / allocate` enumerator, but tractable —
greedy "place where the next 1–2 track cards will hit" gets you a
playable bot. Note it as a build cost, not a blocker.

---

## Recommended narrowing — what to lock in

If you want to cut the design space and start prototyping:

| Decision | Pick |
| --- | --- |
| Spawn shape | **A1 Lanes** (4 columns) |
| Threat motion | **B3 Hybrid** (most march at speed 1; some siege/fast) |
| End-of-track | **C1 Boss** (single boss, multi-phase on its own card) |
| Track scaling | **D1 phase-piles** + **D3 tech overlay** for swaps/peeks |
| Building HP | cost-scaled, floor 3 |
| Damage prorating | ⌈yield × damage%⌉ lost (the punishing reading) |
| Track flip timing | **F1 mid-round** (your call) |
| Wander deck | **G3 fold into track** |
| Stacking | lane-locked + soft cap of 3/building (+1 per upgrade) |
| Telegraph | **next card face-up** by default |
| Grace period | first phase is boons + no-ops + one tutorial threat |

That's the smallest set of picks that produces a complete,
playtestable redesign.

---

## What to prototype first

1. **Paper a single phase.** 5–6 track cards (3 threats, 2 boons, 1
   modifier) in lane format, playing 4–5 rounds. Goal: does the
   per-round wall-time land? Does Defense's turn feel snappy?
2. **If yes, paper the boss-card flow.** A 3-phase boss on the last
   card. Goal: is the climax cinematic, or fiddly?
3. **If yes, build a prototype Defense bot** that places greedily
   against telegraphed track cards. Goal: are tied / network plays
   smooth?

Once those three feel right, the rest of the changes (HP +
repair + grid evolution) are mechanical and can land in code
without further design questions.

---

## Open questions left for the next round (to settle after Q1–Q5
above)

- **Unit HP regen rate** — flat 1/round, or "regen 1 per adjacent
  Tower"? Affects unit math density.
- **Repair priority** — does domestic *have* to repair before
  building new? (Probably not — repair is just one buy option in the
  domestic action menu.)
- **Score** — what does the end-of-game score record (rounds taken,
  HP retained, etc.)?
- **Visual** — do we want a literal mini-map per game in the UI
  (lanes drawn over the domestic grid), or a separate "frontier"
  panel? (Likely the former, but it's a UI design call once mechanics
  are locked.)
- **Number of lanes** — 3 vs 4 vs scale with player count?
- **Unit count cap** — total units in play across the village.
  Without a cap, late-game can become cluttered.

These are tunables, not branches. Park them until the picks above
are committed.
