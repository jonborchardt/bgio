# Foreign mini-game — alternatives report

**Date:** 2026-05-03
**Scope:** the whole foreign loop is on the table, not just the resolver.
**Constraints (from this session):**

- **No dice.** Rules out Risk, classic CDG combat, Memoir/C&C, dice-tower games.
- **No overly complex.** Foreign has to fit inside the parallel others-phase
  alongside science + domestic; it can't become the centerpiece.
- **Must be quick.** The other roles are not watching foreign's turn and won't
  wait on it. Foreign's per-round play has to resolve in roughly the same
  wall-time as a science contribution or a domestic build — a small handful
  of decisions, not a multi-turn scene. This penalises anything with
  multi-turn combat, table-talk-heavy markets, or required participation
  from other seats. Anything multi-turn, table-talk-heavy, or
  cross-seat-coordinated takes a hit on the new Speed axis below.
- **Tabletop-physical.** No mechanic that depends on hidden simultaneous
  arithmetic only an engine can do, or that needs a seat to peek at another
  seat's hand "just for the UI."
- **Preserve "build an army from cards + take tech from other players."** The
  user explicitly likes this part of the current loop — proposals that keep it
  score better.
- **Foreign must defend** — failure must be visible at the table, ideally
  rippling into the rest of the village (because the village "wins or loses
  like Civilization" — currently no loss state, but failure should still
  cost the other roles something concrete).
- **Co-op, 1–4 humans, 4 roles always present.** Bots fill empty seats. Any
  proposal that only works with 4 humans is a non-starter.

---

## Where we are today (the baseline being replaced)

Foreign builds a unit-card hand, pays gold upkeep each round, recruits +
releases units, then **flips a battle card** and runs a deterministic
initiative-ordered combat resolver. Damage allocation is the only real
decision in combat; the rest is read off the cards. Wins → +1 settlement +
bank reward; losses → `pendingTribute` from bank.

Strengths: deterministic, deep card content via tech requirements, real
allocation puzzle. Weaknesses (the user's "I don't love it"):

- Combat is a single allocation puzzle, not a scene with arc.
- Foreign-failure pressure is mostly bank-internal — other roles don't
  *feel* a foreign defeat.
- Tech feeds in but the loop is mostly local: science → red tech → unit
  hand → battle. Chief / domestic involvement is incidental.
- The flip → resolve cadence is identical every round.

These are the dimensions the proposals try to move on.

---

## Scoring rubric (1–5, higher = better)

| Axis | What "5" means |
| --- | --- |
| **Fit** | Co-op civ vibe; sits cleanly inside others-phase parallel turn. |
| **Fun** | Real decisions, table talk, swing moments — not just "do the math." |
| **Right complexity** | One page of rules; learnable in one round; does not bloat foreign past peer roles. |
| **Inter-role pull** | Foreign visibly leans on chief gold / science tech / domestic builds. |
| **Failure ripple** | A foreign loss costs other roles something they can see and feel. |
| **Speed** | Foreign resolves its whole round in seconds, not minutes. No multi-turn combat, no required table talk, no waiting on other seats. |
| **Card-army preserved** | Player still drafts/recruits unit cards with tech gating — the part the user said they like. |
| **No dice** | Hard yes/no; only included as a sanity column. |

A composite "**Net**" is the unweighted sum of the six 1–5 axes (fit + fun +
complexity + inter-role + ripple + speed). Max 30.

---

## The 20 candidates

Each entry: source mechanic → game it's known from → how it would replace
the foreign loop → score grid → notes.

### 1. Two-card power totals

- **Mechanic:** Each side reveals one card; higher number wins.
- **Source game:** *Lost Cities* (Knizia), *War* (childrens' card game).
- **Settlement port:** Battle card has a single "Threat" number. Foreign
  reveals one committed *attack-card hand* (sum of attack across all
  in-play units, modified by tech). Tie → both lose 1 unit, redraw.
- **Score:** Fit 3 / Fun 1 / Complexity 5 / Inter-role 2 / Ripple 2 / Speed 5.
  Net **18**.
- **Notes:** Trivially simple and instant, but kills the army-building joy.
  Listed as a floor.

### 2. Push-your-luck encounter draws

- **Mechanic:** Keep flipping cards from an encounter deck; bank rewards or
  bust.
- **Source game:** *Incan Gold* / *Diamant*, *Quacks of Quedlinburg*.
- **Settlement port:** Foreign flips battle cards one at a time. After each
  win they choose to bank settlements or push for one more (each pushed
  card is harder, with cumulative damage). Bust = lose all banked rewards
  this raid + suffer tribute.
- **Score:** Fit 3 / Fun 4 / Complexity 4 / Inter-role 2 / Ripple 3 / Speed 4.
  Net **20**.
- **Notes:** Fun arc, but the army-building is incidental — the deck does
  the storytelling. Speed is fine since the player chooses when to stop.

### 3. Suit/colour-set defense ("you need 3 reds and a blue")

- **Mechanic:** Threat demands a specific composition of cards.
- **Source game:** *The Crew*, *Lost Cities* expeditions, *Jaipur* sets.
- **Settlement port:** Battle cards say "needs 2× melee + 1× ranged" or
  "needs Cavalry + Auto." Foreign assigns committed units that match. No
  numeric resolution — match the recipe or fail. Mismatch = partial
  reward + partial tribute.
- **Score:** Fit 4 / Fun 3 / Complexity 4 / Inter-role 4 / Ripple 3 / Speed 4.
  Net **22**.
- **Notes:** Strong inter-role pull because *which* recipes show up reward
  certain tech draws — chief and science can target their decisions. Speed
  is good: match cards to recipe, done — no resolution loop.

### 4. Blind-bid for missions

- **Mechanic:** Each side commits cards face-down; reveal simultaneously.
- **Source game:** *Modern Art* (Knizia), *Cyclades*.
- **Settlement port:** A row of 3–4 mission cards. Foreign secretly assigns
  unit cards face-down to each mission. Reveal at end of round. Each
  mission has a printed difficulty; total committed attack ≥ difficulty
  → win that mission. Spreading thin = winning more, smaller rewards.
- **Score:** Fit 4 / Fun 4 / Complexity 4 / Inter-role 3 / Ripple 5 / Speed 4.
  Net **24**.
- **Notes:** "How wide do I spread?" is the new puzzle — replaces damage
  allocation with deployment allocation. One commit + one reveal per
  round = naturally fast. Pairs especially well with the user's preferred
  failure model: missed mission → cube on village + units committed to
  the failed mission are *exhausted from the stash equivalent* (units
  spent on a lost bid feel like burnt resources, satisfying the
  "discourage hoarding" goal).

### 5. Worker-placement raid spots

- **Mechanic:** Send units to action spots that pay over rounds.
- **Source game:** *Agricola*, *Lords of Waterdeep*, *Tzolk'in*.
- **Settlement port:** A board of 4–6 expedition tiles (Trade Caravan,
  Border Skirmish, Frontier Watch, Settlement Push). Foreign places units
  onto tiles; tiles pay back 1–3 rounds later. Some tiles need specific
  unit types. Tiles refill from the battle deck.
- **Score:** Fit 4 / Fun 4 / Complexity 3 / Inter-role 3 / Ripple 4 / Speed 3.
  Net **21**.
- **Notes:** Deeply tabletop. Failure mode: a tile that resolves un-met
  damages domestic. Risk: another worker-placement role might overlap with
  domestic's identity. Speed is OK but multiple placements + resolution
  rounds slow it down.

### 6. Slay-the-Spire-style hand-played combat

- **Mechanic:** A combat deck of action cards; play a hand each turn until
  the encounter ends; deck cycles between fights.
- **Source game:** *Slay the Spire*, *Dawn of Ulos*, *Aeon's End*.
- **Settlement port:** Each unit IS a card in foreign's combat deck.
  Recruiting = adding the card. Each battle: shuffle, draw 5, play any.
  Tech cards are upgrades or events you slot into the deck. Threats are
  multi-step encounters with their own action cards.
- **Score:** Fit 5 / Fun 5 / Complexity 3 / Inter-role 4 / Ripple 4 / Speed 2.
  Net **23**.
- **Notes:** Highest "fun" potential and preserves army-building exactly.
  **Speed is the killer constraint here** — multi-turn combat per encounter
  is exactly the wait the user wants to avoid. Salvage path: cap each
  encounter at "play one hand of 3 cards, resolve, done" — a *miniature*
  StS rather than a full one. That keeps the deck-building flavour but
  makes each round a single hand-play.

### 7. Tableau-combo deckbuilder

- **Mechanic:** Buy unit cards from a market; play your whole hand each
  turn; cards combo when both are in play.
- **Source game:** *Star Realms*, *Hero Realms*, *Ascension*.
- **Settlement port:** Foreign has a draw deck (recruited units) and plays
  the full hand vs threat each round. Combos: e.g. "Spearman + Shield
  Bearer = +2 attack." Tech cards modify combos.
- **Score:** Fit 5 / Fun 4 / Complexity 3 / Inter-role 3 / Ripple 3 / Speed 3.
  Net **21**.
- **Notes:** Already named as the spiritual ancestor in
  `docs/game-design.md`. Tableau-combo is more swingy than #6 but more
  memorable. Slightly less inter-role than #6 because tech becomes one
  more combo bonus. Speed is middling — playing the whole hand and
  resolving combos is faster than StS but still longer than a one-card
  reveal.

### 8. Battle Line three-front column commit

- **Mechanic:** Three lanes; play unit cards down a lane; complete a lane
  (e.g. 3 cards) to score it; high-poker-hand wins.
- **Source game:** *Battle Line* / *Schotten Totten* (Knizia).
- **Settlement port:** Each round shows three Frontier columns. Foreign
  commits units (one per column) over multiple rounds; when a column
  fills, it scores. Threats counter-commit from the battle deck (face up,
  passive — no opponent decisions).
- **Score:** Fit 4 / Fun 4 / Complexity 4 / Inter-role 3 / Ripple 3 / Speed 4.
  Net **22**.
- **Notes:** No dice, very pure. Multi-round columns mean foreign always
  has something in flight; a lost column hurts the village concretely
  (loss of an in-progress lane = wasted units). **Per-round** play is
  fast — one card per lane, lanes only resolve when full.

### 9. Card-driven area control (diceless ops)

- **Mechanic:** Cards have ops values; spend ops to place influence in
  regions; majorities resolve at scoring.
- **Source game:** *Twilight Struggle*, *1960: Making of the President*.
- **Settlement port:** Foreign holds a hand of "Op cards" (drawn each
  round). Spend ops to place units in border regions. End of round:
  region majority decides whether it's a settlement gain (+1) or
  settlement loss (raiders push back). Tech cards modify ops.
- **Score:** Fit 4 / Fun 4 / Complexity 2 / Inter-role 4 / Ripple 5 / Speed 2.
  Net **21**.
- **Notes:** Very strong ripple — the *map* becomes the table-shared
  visual of foreign success/failure. Complexity is the danger here; needs
  a tiny map. Speed is poor: multi-region ops decisions are exactly the
  kind of slow, deliberate turn the user wants to avoid.

### 10. Twilight Struggle "ops or event" choice

- **Mechanic:** Every card has both an event and an ops value; using one
  forfeits the other.
- **Source game:** *Twilight Struggle*.
- **Settlement port:** Each tech *and* each unit is dual-use: play as a
  unit (recruit it) or play as a one-shot event (e.g. Scout = "see the
  next 2 battle cards"). Forces a real decision every flip.
- **Score:** Fit 4 / Fun 4 / Complexity 3 / Inter-role 3 / Ripple 2 / Speed 3.
  Net **19**.
- **Notes:** Ripple is weak — this is mostly a foreign-internal tension.
  Ride-along: every existing card can carry both modes with one extra
  text line, content cost is small. Speed is fine when the choice is
  binary; slows if the player overthinks it.

### 11. Pax Pamir market-row + tableau

- **Mechanic:** Public market of cards; players buy and tableau them; cards
  in the tableau give ongoing abilities and faction alignment.
- **Source game:** *Pax Pamir 2e*, *Pax Renaissance*.
- **Settlement port:** A shared "Mercenary market" of unit cards. Chief
  funds purchases (chief gold spend), foreign places them. Cards come out
  in coalitions — the *village* slowly tilts toward a doctrine
  (cavalry-heavy, scout-heavy, etc.) and threats counter-target whichever
  doctrine is dominant.
- **Score:** Fit 4 / Fun 4 / Complexity 2 / Inter-role 5 / Ripple 4 / Speed 2.
  Net **21**.
- **Notes:** Maximum chief-engagement (chief literally bankrolls each
  unit). **Speed sinks this** under the new constraint: chief involvement
  per round means foreign waits on chief, and chief waits on foreign.
  Exactly the cross-seat coordination the user said to avoid.

### 12. Spirit Island invader-track + power cards

- **Mechanic:** Enemy actions advance on a deterministic track; player
  plays power cards to mitigate before the track fires.
- **Source game:** *Spirit Island*.
- **Settlement port:** A "raid track" advances each round. Foreign plays
  unit cards (now treated as one-shot powers) to interfere before the
  track resolves. Failure = resolved track hits the village (loses
  domestic building / chief gold / a tech).
- **Score:** Fit 5 / Fun 4 / Complexity 3 / Inter-role 4 / Ripple 5 / Speed 3.
  Net **24**.
- **Notes:** Best "civ-style failure ripples" of any candidate.
  Spirit Island is heavier than we want but the *core loop* (track +
  cards) is clean and adapts down. Risk: turning units into one-shots
  weakens the "permanent army" flavour — could be hybrid (units stay,
  techs become the one-shots). Speed is acceptable: per round, foreign
  plays 1–3 power cards and the track resolves once. Cap mitigation
  options at 2–3 per round to keep it tight.

### 13. Memoir '44 row-defense, *card-section without dice*

- **Mechanic:** Battlefield split into Left/Center/Right; section cards
  let you act in matching sections; combat resolved card-by-card (we'd
  swap dice for printed card outcomes).
- **Source game:** *Memoir '44*, *Commands & Colors*.
- **Settlement port:** Three lanes (mirrors §3.4 alt 4 in
  `docs/game-design.md`). Foreign's hand of section cards selects which
  lane(s) act; combat resolved by printed card values, no dice.
  Threats spawn into specific lanes from the battle deck.
- **Score:** Fit 3 / Fun 3 / Complexity 2 / Inter-role 2 / Ripple 4 / Speed 3.
  Net **17**.
- **Notes:** Tight but mechanically thin once we strip the dice. If the
  domestic grid ever becomes spatial (rows), this comes back into scope
  — currently not a fit.

### 14. Battle Line × set-collection hybrid (Schotten Totten + Crew)

- **Mechanic:** Lanes scored not by sum but by recipe (run, set, suit).
- **Source game:** *Schotten Totten 2*, *The Crew*.
- **Settlement port:** Same three-lane shape as #8, but each lane scores
  on a recipe (e.g. "two of same suit + a higher-attack capper"). More
  decision density per commit. Tech cards add wild-card slots.
- **Score:** Fit 4 / Fun 4 / Complexity 3 / Inter-role 3 / Ripple 3 / Speed 3.
  Net **20**.
- **Notes:** Slightly fiddlier than #8 but more replayable — recipes
  reshuffle the optimal army each game. Recipe-checking adds a small
  speed tax over plain Battle Line.

### 15. MTG attack/block declarations

- **Mechanic:** Attacker declares which units swing; defender assigns
  blockers; combat damage assigned per attacker.
- **Source game:** *Magic: The Gathering*.
- **Settlement port:** What we already have, fundamentally. Could be
  *tightened* with player-driven blocking decisions (currently the
  resolver does it for them) and combat tricks via tech cards.
- **Score:** Fit 5 / Fun 3 / Complexity 4 / Inter-role 3 / Ripple 3 / Speed 3.
  Net **21**.
- **Notes:** This is the "iterate, don't replace" choice. Fastest *path*
  to ship, but doesn't address the user's "I don't love this" — it's
  the same thing slightly better. Speed 3 because adding player-driven
  blocking decisions is the one slowdown vs the current resolver.

### 16. Phase-wheel role-stage selection

- **Mechanic:** A small wheel of action types; one is chosen per round and
  everyone gets that action's powers.
- **Source game:** *Race for the Galaxy*, *Puerto Rico*.
- **Settlement port:** Each round one player picks a "campaign mode"
  (Raid / Scout / Trade / Defend); foreign gets the *full* benefit, the
  picker gets a small bonus, others get a smaller one. Lets non-foreign
  seats steer foreign's tempo.
- **Score:** Fit 3 / Fun 4 / Complexity 3 / Inter-role 5 / Ripple 3 / Speed 2.
  Net **20**.
- **Notes:** Highest table-shared decision-making, but stretches outside
  the foreign loop into the whole round structure — a bigger redesign
  than the others. Directly violates the speed constraint: the picker
  is making the *table* think about foreign every round.

### 17. Pandemic-style cube outbreak

- **Mechanic:** Threat tokens spawn on regions; if they exceed a cap,
  outbreak spreads to neighbours.
- **Source game:** *Pandemic*.
- **Settlement port:** Threat cubes accumulate around the village each
  round. Foreign commits units to regions to clear cubes. Outbreaks
  damage adjacent domestic buildings or burn chief gold.
- **Score:** Fit 5 / Fun 4 / Complexity 3 / Inter-role 4 / Ripple 5 / Speed 3.
  Net **24**.
- **Notes:** **The user explicitly described this mechanic** as the
  desired failure mode — "markers left on domestic village that need to
  be cleared." That promotes #17 from "good ripple option" to "the
  failure layer this game wants." Repositioned in the recommendation as
  a **shared ingredient** under any Tier 1 resolution mechanic, not just
  a standalone candidate. Speed is fine if regions stay small (~4);
  scales poorly past that.

### 18. Through the Ages military-strength compare

- **Mechanic:** Players have a passive military strength number; threats
  and inter-player events compare to it without a "battle."
- **Source game:** *Through the Ages: A New Story of Civilization*.
- **Settlement port:** Foreign army has a printed Strength. Each round, a
  Frontier card flips and demands strength ≥ N to win the settlement
  (else tribute). No tactical play — your army composition just *is* the
  answer.
- **Score:** Fit 4 / Fun 2 / Complexity 5 / Inter-role 3 / Ripple 5 / Speed 5.
  Net **24**.
- **Notes:** Very low decision density inside foreign's turn — but
  **fastest-resolving option on the list** and insanely thematic for a
  civ co-op. Under the speed constraint this is a serious contender as
  the *base* layer with one of the others bolted on for the actual
  decisions. Compare-fail = cube on village (the fixed failure layer
  applies cleanly); ripple bumps to 5.

### 19. Smash Up faction stacking

- **Mechanic:** Each player picks two factions; the deck is the union; the
  army has dual identity.
- **Source game:** *Smash Up*.
- **Settlement port:** Foreign starts with a base unit branch (Militia)
  and gets to layer a second branch as it unlocks (Cavalry, Auto, etc.).
  Combos cross-pollinate. Tech from science decides which second branch
  is reachable.
- **Score:** Fit 4 / Fun 4 / Complexity 4 / Inter-role 4 / Ripple 2 / Speed 4.
  Net **22**.
- **Notes:** Mostly a content-shape change rather than a new combat
  mechanic — pairs well with #6 or #7 as a layer on top. Speed-neutral:
  the second branch lives in the deck, not in extra per-round decisions.

### 20. Bag-build threat draws (Quacks/Nemesis)

- **Mechanic:** A bag fills with threat tokens that get drawn each round;
  player can also add "good" tokens.
- **Source game:** *Nemesis*, *Quacks of Quedlinburg*, *Orleans*.
- **Settlement port:** Replace the battle deck with a threat bag. Bag
  starts mild; events / wanders / failed missions add nasty tokens.
  Foreign draws N each round and has to absorb / counter each one with
  unit cards. Pure card-army-vs-bag.
- **Score:** Fit 4 / Fun 4 / Complexity 3 / Inter-role 3 / Ripple 5 / Speed 4.
  Net **23**.
- **Notes:** The bag is the long-arc pressure system. Failure literally
  poisons the bag for next round, *and* unabsorbed tokens can drop as
  cubes onto the village — double-stacked ripple. Borderline "is bag-draw
  the same as dice?" — it's not (history-dependent, deterministic in the
  long run, all moves visible). Speed is good: draw N tokens, absorb with
  units, done — single resolution per round.

---

## Summary table (sorted by Net, with Speed)

Note: any candidate marked with ⚙ has its **Ripple** score boosted by
the user-chosen failure layer (cubes on the domestic village + stash
burn). That layer is described as a fixed ingredient under §"The
fixed failure layer" below, so several ripple scores are now uniformly
high — Ripple is a less-discriminating axis under the new framing.

| # | Idea | Source | Fit | Fun | Cplx | Inter | Ripple | **Speed** | **Net** | Card-army? |
| - | --- | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 4 | Blind-bid missions ⚙ | Modern Art / Cyclades | 4 | 4 | 4 | 3 | 5 | 4 | **24** | ✅ |
| 12 | Invader-track + powers | Spirit Island | 5 | 4 | 3 | 4 | 5 | 3 | **24** | ✅ (hybrid) |
| 17 | Cube outbreak | Pandemic | 5 | 4 | 3 | 4 | 5 | 3 | **24** | ⚪ |
| 18 | Strength compare ⚙ | Through the Ages | 4 | 2 | 5 | 3 | 5 | 5 | **24** | ✅ (passive) |
| 6 | Slay-the-Spire combat-deck | StS / Aeon's End | 5 | 5 | 3 | 4 | 4 | 2 | **23** | ✅ |
| 20 | Threat bag-build ⚙ | Nemesis / Quacks | 4 | 4 | 3 | 3 | 5 | 4 | **23** | ✅ |
| 3 | Recipe defense | The Crew / Jaipur | 4 | 3 | 4 | 4 | 3 | 4 | **22** | ✅ |
| 8 | Three-front lanes | Battle Line | 4 | 4 | 4 | 3 | 3 | 4 | **22** | ✅ |
| 19 | Faction stacking | Smash Up | 4 | 4 | 4 | 4 | 2 | 4 | **22** | ✅ |
| 5 | Worker-placement raids | Agricola / LoW | 4 | 4 | 3 | 3 | 4 | 3 | **21** | ✅ |
| 7 | Tableau combos | Star Realms | 5 | 4 | 3 | 3 | 3 | 3 | **21** | ✅ |
| 9 | Card ops + areas | Twilight Struggle | 4 | 4 | 2 | 4 | 5 | 2 | **21** | ⚪ |
| 11 | Market + coalitions | Pax Pamir | 4 | 4 | 2 | 5 | 4 | 2 | **21** | ✅ |
| 15 | MTG-style declarations | MTG | 5 | 3 | 4 | 3 | 3 | 3 | **21** | ✅ |
| 2 | Push-your-luck flips | Incan Gold | 3 | 4 | 4 | 2 | 3 | 4 | **20** | ⚪ |
| 14 | Lane recipes | Schotten Totten 2 | 4 | 4 | 3 | 3 | 3 | 3 | **20** | ✅ |
| 16 | Action-phase wheel | Race / Puerto Rico | 3 | 4 | 3 | 5 | 3 | 2 | **20** | ⚪ |
| 10 | Ops-or-event dual cards | Twilight Struggle | 4 | 4 | 3 | 3 | 2 | 3 | **19** | ✅ |
| 1 | Power-total reveal | Lost Cities | 3 | 1 | 5 | 2 | 2 | 5 | **18** | ❌ |
| 13 | Section-card lanes | Memoir '44 | 3 | 3 | 2 | 2 | 4 | 3 | **17** | ⚪ |

---

## The fixed failure layer (settled)

The user chose the failure model: **cubes (or markers) appear on the
domestic village when foreign loses, and need to be cleared**, and/or
**failed actions burn stashed resources** (the village can't sit on a
hoard waiting for safety). This is taken as a **fixed ingredient** that
applies under any resolution mechanic the report ends up recommending —
not an alternative. Concretely:

- **Marker on village.** A failed encounter drops 1+ marker tokens on
  the domestic grid. Markers occupy cells (block production, block new
  building placement, or zero out a building's yield until cleared).
  Cleared by chief workers, by domestic spending a clear action, or by
  foreign winning subsequent encounters in that region.
- **Stash burn.** Resources committed to a failed action are lost
  rather than refunded — *and* failed encounters can debit one or more
  seats' stash directly, so the longer you sit on a stash hoarding for
  a future build, the more you stand to lose.
- **Optional widening.** Bigger losses can also debit chief gold from
  the bank (current behavior), force a science contribution to be
  forfeit, or escalate the wander deck. These are dials on top of the
  base cube + stash mechanics.

This layer borrows directly from #17 (Pandemic) for the cubes and from
the user's own description of stash-burn for the resource bleed. It
applies regardless of which resolution mechanic wins below.

## Recommendation — what to prototype

With the failure layer fixed, the question narrows to **which
resolution mechanic** runs on top of it. Speed is still the hard
constraint; #11 Pax Pamir, #9 area-control, and #16 phase-wheel stay
out for that reason.

### Tier 1 — the four 24-point resolutions, ranked by what they fix

All four sit at Net 24 because the failure layer is now common. The
ranking inside Tier 1 is by which **complaint** each one solves:

1. **#18 Strength-compare as the base layer.** Speed 5 — the only
   option that resolves in literally one comparison. Most rounds are
   "army strength meets the Frontier card, +1 settlement, done." This
   is the answer to "play has to be smooth and other players aren't
   waiting." The tradeoff is Fun 2 *on its own* — so don't ship it
   alone. Use it as the floor under one of the next two.

2. **#4 Blind-bid missions** as the decision layer over #18. When a
   Frontier card calls for it (or every Nth round), reveal a row of
   3–4 mission cards; foreign secretly commits unit cards face-down to
   them. Reveal, score, fail-cubes drop on the village for missed
   missions, committed units on failed bids are exhausted (= stash
   burn for the army). One decision moment per round, very fast, and
   the deployment-spread puzzle replaces the current
   damage-allocation puzzle without slowing anything.

3. **#12 Spirit Island invader-track + power cards** as the pressure
   layer. A deterministic raid track ticks each round; foreign plays
   1–3 red-tech "power cards" onto it to mitigate before it fires. If
   it fires — village cube. This is the option that gives the army a
   *narrative* (the threat is approaching, you're slowing it) at
   per-round speed.

4. **#17 Pandemic cubes** is **upgraded to "the failure layer"** above
   and is no longer a competing resolution mechanic. Don't pick it as
   the resolver; pick it as the universal cost.

### Tier 2 — strong supporting / variant ingredients

- **#20 Threat bag-build** (Net 23) — best *encounter generator*. Drop
  it under #4 or #18 to replace the battle deck. Bag fills with nasty
  tokens when the village fails; foreign draws N each round and
  absorbs them with units. Composes naturally with the cube failure
  layer.
- **#6 StS deck-builder, capped variant** (Net 23) — only viable
  capped to "one hand of 3 cards per encounter," but the
  upgrade-deck-from-tech affordance is still the cleanest "tech from
  other players" surface on the list. Park as a possible later
  expansion.
- **#3 Recipe defense** (Net 22) — alternative to #4 if "spread units
  across mission slots" feels too abstract: same speed, same shape,
  but the threat names the recipe instead of leaving the spread to
  the player.
- **#8 Three-front lanes** (Net 22) — multi-round commitment that
  stays per-round-fast (one card per lane); good fallback if both
  blind-bid and strength-compare feel wrong.
- **#19 Smash Up faction stacking** (Net 22) — pure content layer; can
  bolt onto any Tier 1 to give science tech a more visible effect on
  army identity.

### Tier 3 — speed kills these

- **#11 Pax Pamir market** — best inter-role pull on the list, but
  asks for cross-seat coordination every round. Direct conflict with
  "other players aren't watching."
- **#9 Twilight-Struggle ops + areas, #16 Phase-wheel** — multi-step
  thinking turns; both score Speed 2. Park these.
- **#1, #13** — too thin to be worth the redesign cost.
- **#15 MTG-tighten** — no-redesign fallback only; doesn't solve the
  user's complaint.

### Suggested experiment shape

Build the **#18 base + #4 decision layer + #17 cube/stash failure
layer** stack on paper first. Concretely:

- **Each round:** flip a Frontier card. It declares either
  - *Strength check* (most rounds): foreign's in-play army strength ≥
    N → +1 settlement, no decision needed. Strength < N → cubes
    drop, stash burns. Round ends in seconds.
  - *Mission spread* (every Nth round, or when the track ticks):
    reveal 3 mission cards. Foreign secretly commits units to them.
    Reveal, score per slot. Missed slots → cubes. Units committed to
    missed slots → exhausted (stash burn equivalent for the army).
- **Pressure layer (optional second wave):** add #12's track. The
  track advances each round, and at threshold values it forces a
  cube to drop *regardless* of the round's outcome. Foreign's red
  tech is the power-card pool that can push the track back.
- **Encounter generator (optional):** swap the battle deck for #20's
  threat bag, so the difficulty of each round's Frontier card is
  drawn from a bag that fills with worse tokens after failures.

This stack gives:

- **Speed** by default — most rounds are a number compare.
- **A real decision moment** when missions show up.
- **Visible failure** — domestic grid covered in cubes, stashes shrink.
- **Permanent army** preserved — unit cards stay in play and feed
  strength.
- **Tech import** preserved — red tech is the power-card pool that
  pushes back the track.
- **Bot-friendly** — strength compare and bid-allocation are easy to
  enumerate; the user confirmed bot complexity is not a constraint.

If the stack feels heavy, drop the pressure layer (#12) first; if
strength-compare feels too thin, swap #18 for #4 alone with mission
rounds every turn.

---

## Resolved questions (from session)

These were the open questions in the previous draft; the user has
answered them, and the answers are baked into the recommendation
above. Recorded here for traceability:

1. **Permanent army or cycling deck?** *Either is fine.* Both shapes
   are acceptable to the user, so this stops being a tiebreaker.
   Recommendation defaults to permanent (matches #18 / #12 / #4) but
   doesn't rule out a deck-cycling variant later.
2. **One battle per round vs in-flight across rounds?** *Doesn't
   matter as long as per-round play is smooth.* Removes the penalty
   on multi-round shapes (#5 / #8 / #14) — what matters is that each
   round resolves quickly, not whether a single encounter spans
   multiple rounds.
3. **What does failure cost?** *Cubes on the domestic village (must
   be cleared) + stash burn (discourages hoarding); can also cost
   chief gold and possibly science contributions.* This is now the
   **fixed failure layer** (see above) rather than a per-candidate
   variable, and it borrows directly from #17.
4. **Bot tractability.** *Not a constraint — bot logic can be coded
   to fit whatever resolution wins.* Removes the bot-difficulty
   penalty from #11 / #9 / #16, but those still lose on speed.

The remaining unsettled question — and the only one that affects
which Tier 1 finalist ships first — is whether **most rounds should
auto-resolve** (#18 base) or **most rounds should open a small
decision** (#4 base). This is a feel question that paper play will
answer faster than any further analysis.
