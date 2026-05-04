# Science mini-game — juice-it-up ideas

**Date:** 2026-05-03
**Sibling:** [foreign-mini-game-ideas.md](./foreign-mini-game-ideas.md),
[defense-redesign-spec.md](./defense-redesign-spec.md)
**Scope:** the science role's per-turn experience. Unlike the foreign
report, this is **not a full-rewrite study** — the user said they like
the existing science deck (3×4 grid + tech distribution) in general.
The complaint is narrower: *"science just buys one thing and their
turn is over."* Goal is to add density and decisions to the science
seat's per-round play without breaking the current contribute /
complete / distribute pipeline that other roles depend on.

**Constraints (from this session and from CLAUDE.md):**

- **Keep the science deck.** Contribute → complete → distribute-by-color
  is core. Proposals score better when they ride on top of it; pure
  replacements still listed but flagged.
- **Tabletop-physical.** Cards, tokens, tiles, dials, bags, drafts.
  No mechanic that requires hidden simultaneous arithmetic only an
  engine can do.
- **Quick.** Science acts in parallel inside the others-phase. The
  whole science turn must still resolve in roughly the same wall-time
  as a domestic build or a defense placement.
- **No dice.** (Inherited from the foreign report's session
  constraint.)
- **Co-op, 1–4 humans, 4 roles always present.** Bots fill empty
  seats. Anything that only works with 4 humans is out.
- **Defense redesign assumed.** D27 in
  [defense-redesign-spec.md](./defense-redesign-spec.md) already adds
  `scienceDrill` + `scienceTeach` to the science seat. Treat those
  as already in the kit; the ideas below are *additional* density,
  not duplicates of teach/drill.
- **No fail mode.** Science failure should manifest as forgone
  upside, slower tech delivery to other roles, or wasted setup —
  never a loss state.

---

## Where we are today (the baseline)

Per [Rules.md](../docs/Rules.md) §5.2.1 and
[src/game/roles/science/](../src/game/roles/science/):

Each round, the science seat may:

1. Play **1 blue event card** (most rounds: zero, the hand is small).
2. **Contribute** stash resources onto the lowest-level uncompleted
   card in any color column. (Often the *only* meaningful action.)
3. **Complete** a card whose paid tally covers cost, distributing 4
   tech cards underneath to chief/science/domestic/defense by color.
   **Capped at 1 completion per round.**
4. **Play** any blue tech in hand whose `onPlayEffects` is non-empty.
   (Most blue techs in V1 don't have on-play effects yet.)
5. **End my turn.**

After D27 lands: also `scienceDrill` (mark a unit, +1 strength next
fire, once/round) and `scienceTeach` (durable skill grant to a unit,
once/round).

**Diagnosis.** On any round where the seat is not yet at the
"complete" threshold, the entire turn is one `scienceContribute`
move. The 1-completion-per-round cap was added so late-game rounds
don't snowball, but in practice it caps the seat's *interesting*
turns at ~1 per round too. The grid is rich; the per-round play
isn't.

**Strengths to preserve.**
- The 3×4 grid as a mid-game visual artefact.
- The "tech card under each science card, distributed by color"
  pipeline — this is the role's identity (you're the village's
  *gift-giver*).
- The lowest-first column constraint.
- Science feeds defense via D27 drill/teach.

**What we want more of.**
- Per-turn decisions that don't require completing a card.
- Inter-role friction beyond the once-per-round tech delivery.
- Memorable swing moments that reward planning.
- A stash that's *worth spending* down even when no card is close to
  finishing.

---

## Scoring rubric (1–5, higher = better)

| Axis | What "5" means |
| --- | --- |
| **Fit** | Co-op civ vibe; sits cleanly inside others-phase parallel turn; reads as something a "scientist / school" role would do. |
| **Fun** | Real decisions, table talk, swing moments — beyond paying resources. |
| **Right complexity** | One page of rules; learnable in one round; doesn't bloat science past peer roles. |
| **Inter-role pull** | Other roles visibly receive, fight over, or shape what science does — not just at completion-time. |
| **Turn density** | The seat has *more than one* meaningful decision per round. Directly addresses the user's complaint. |
| **Speed** | Whole science turn still resolves in seconds; doesn't make others-phase wait. |
| **Deck-preserved** | The 3×4 grid + tech-under-card + distribute-by-color survives intact. (Soft preference; 0/1 indicator.) |

A composite "**Net**" is the unweighted sum of the six 1–5 axes
(fit + fun + complexity + inter-role + density + speed). Max 30.
**Deck-preserved** is shown but not summed.

---

## The 20 candidates

Each entry: source mechanic → game it's known from → how it would
plug into science → score grid → notes.

### 1. Card-reservation with wild

- **Mechanic:** Reserve one face-up card for yourself; it's locked from
  others, and you gain a wild token usable on any future spend.
- **Source game:** *Splendor*.
- **Settlement port:** Once per turn, science can **reserve** any
  uncompleted card on the grid. The card is visibly tagged "reserved
  by science." While reserved: only the science seat may contribute
  to it, *and* the reservation grants science a single **wild token**
  (counts as any 1 resource for one future contribute or play).
  Reservation persists across rounds; consuming the wild releases the
  reservation.
- **Score:** Fit 5 / Fun 4 / Cplx 5 / Inter 3 / Density 4 / Speed 5.
  Net **26**. Deck-preserved ✅.
- **Notes:** Tiny rule, big density gain. The reservation is a
  per-round decision *separate* from contribute, so the turn now has
  two beats. Inter-role pull is moderate — reservation shapes which
  tech queue dries up next, which the other roles feel.

### 2. Permanent discount tableau

- **Mechanic:** Cards you complete give you ongoing discounts on
  future card costs.
- **Source game:** *Splendor* (the bonuses), *Race for the Galaxy*.
- **Settlement port:** Each completed science card prints a
  **discount chip** (e.g. "−1 wood on future contributes"). Chips
  accumulate face-up next to the science mat and stack across cards.
  Late-game contributions get cheap and fast.
- **Score:** Fit 5 / Fun 4 / Cplx 4 / Inter 2 / Density 3 / Speed 5.
  Net **23**. Deck-preserved ✅.
- **Notes:** Doesn't add a new beat per turn — it makes the existing
  beat snowball. Real fun comes from card combos. Pairs naturally
  with #1: reserve cheap + bank discounts.

### 3. Multi-card parallel work

- **Mechanic:** Lift the 1-per-round completion cap; pay an
  escalating cost for the second + third completion in the same
  round.
- **Source game:** *Through the Ages* (action point spend),
  *Innovation* (free actions + paid extras).
- **Settlement port:** First completion this round = free, as today.
  Second completion this round = pay an extra **3 science** to
  trigger. Third = +6 science. Beyond is impossible. Lifts the
  ceiling on big rounds without removing the cap entirely.
- **Score:** Fit 4 / Fun 4 / Cplx 4 / Inter 4 / Density 5 / Speed 4.
  Net **25**. Deck-preserved ✅.
- **Notes:** Directly attacks the "1 thing and done" complaint —
  some rounds you can chain two or three. Inter-role bumps because
  a chained completion is a **flood of tech cards** to the other
  roles in one round, which the others can plan around.

### 4. Public offer-row + drift

- **Mechanic:** A face-up offer row that drifts cheaper each round
  it sits unbought; oldest card discarded if the row is full.
- **Source game:** *Suburbia*, *Through the Ages*, *Concordia
  Salsa*, *Ark Nova* market.
- **Settlement port:** Replace the column-based "lowest-first" rule
  with a single **offer row of N cards** (say 5) drawn off the
  science deck. Costs decay 1 resource per round un-bought. When
  science completes one, replace from the deck. Tech-under-card
  distribution unchanged; columns no longer exist.
- **Score:** Fit 4 / Fun 4 / Cplx 4 / Inter 3 / Density 3 / Speed 5.
  Net **23**. Deck-preserved ⚠ (grid replaced; tech distribution
  preserved).
- **Notes:** Replacement, not layer. The cost-drift adds a "snipe
  vs. wait" tension every round but loses the column/tier
  visualization the user likes. Listed for completeness; not
  recommended.

### 5. Tech tableau combos

- **Mechanic:** Tech cards in your tableau combo when paired; cards
  read each other.
- **Source game:** *Race for the Galaxy*, *Wingspan*, *Star Realms*.
- **Settlement port:** Blue tech cards distributed to the science
  hand are no longer "play once and gone." They go into a **science
  tableau** face-up. Each tableau card prints an ongoing rule (e.g.
  "When chief distributes, +1 science to your stash" or "Pay 1 less
  steel on red columns"). Cards reference each other ("+1 if you
  also have *Library*"). Tableau is permanent, a science *deck of
  things you've learned*.
- **Score:** Fit 5 / Fun 5 / Cplx 3 / Inter 4 / Density 4 / Speed 5.
  Net **26**. Deck-preserved ✅.
- **Notes:** The cleanest "make blue tech matter" play on the list.
  Right now blue techs are largely inert in V1; this gives every
  one a reason to exist on the table. Inter-role pull rises because
  several tableau triggers fire on *other* roles' moves, so
  science feels engaged every round.

### 6. Card drafting

- **Mechanic:** Hand-pass drafting — pick one, pass the rest.
- **Source game:** *7 Wonders*, *Sushi Go!*, *Magic*.
- **Settlement port:** At setup of each science "age" (every 8–10
  rounds), instead of dealing the grid via shuffle, deal a **5-card
  pack** to the science seat, who picks 1 and passes the pack to
  the *next* role (chief). They pick 1, pass on. Final card returns
  to science. The 4 picked cards seed the next age's grid plus
  give chief/domestic/defense an early peek + small bonus on their
  picked color.
- **Score:** Fit 4 / Fun 5 / Cplx 3 / Inter 5 / Density 2 / Speed 3.
  Net **22**. Deck-preserved ⚠ (grid is now drafted, not
  shuffled).
- **Notes:** Maximum inter-role drama at age boundaries — but the
  drafting moment is *separate from* per-round science play, so
  density isn't really moved. Plus, drafting is slow at the table
  for 4 humans. Likely an expansion.

### 7. Research track

- **Mechanic:** A linear track with cumulative thresholds; each
  threshold unlocks a new ability.
- **Source game:** *Terra Mystica* / *Gaia Project* (research),
  *Through the Ages* (military / civic tracks).
- **Settlement port:** Add a **Knowledge track** — every science
  contributed (anywhere) advances science 1 step on the track,
  *regardless of which card it lands on*. Track has thresholds at
  steps 5/10/15/20 that unlock: extra hand size, draw 1 tech of
  choice, +1 wild reservation slot, etc. Independent of card
  completion.
- **Score:** Fit 5 / Fun 4 / Cplx 4 / Inter 2 / Density 4 / Speed 5.
  Net **24**. Deck-preserved ✅.
- **Notes:** Additive on top of the grid — science feels they're
  always making *some* progress every contribute, not just
  inching toward the same card. Ripples to other roles weakly
  (the unlocks help science help them).

### 8. Hand-driven action selection

- **Mechanic:** Each round you play a card from your hand that
  determines *what* you do that round; spent cards rotate back via
  age refresh.
- **Source game:** *Concordia* (personality cards), *Hadrian's
  Wall*, *Fields of Arle*.
- **Settlement port:** Science holds a small **scientist hand** —
  6 character cards: *Researcher* (extra contribute), *Librarian*
  (peek next 3 techs), *Architect* (build a science card discount
  for domestic), *Surveyor* (look at the wander deck top), etc.
  Each round, science plays exactly one. Played cards rotate back
  every N rounds.
- **Score:** Fit 5 / Fun 5 / Cplx 3 / Inter 4 / Density 4 / Speed 4.
  Net **25**. Deck-preserved ✅.
- **Notes:** Adds a real "what kind of turn am I taking?"
  decision before the contribute even happens. Higher rules cost
  than a single tableau (more text on cards), but the cards are
  small and finite (6–8). Doesn't replace anything; layers on.

### 9. Bag-build "ingredient" research

- **Mechanic:** Add tokens to a personal bag; draw a hand from the
  bag each round; pushed-luck combinations.
- **Source game:** *Quacks of Quedlinburg*, *Orleans*.
- **Settlement port:** Instead of (or alongside) contributing
  resources to a card directly, the science seat can **add
  research tokens** of varied colors to a personal bag. Each round
  draw 3 tokens at the start of the science turn; matching the
  draw to the active card's needed colors counts toward
  completion. Push-luck: keep drawing for bonus, bust if you draw
  a "fail" token (rare).
- **Score:** Fit 3 / Fun 5 / Cplx 3 / Inter 2 / Density 5 / Speed 4.
  Net **22**. Deck-preserved ⚠ (replaces direct contribution;
  grid intact).
- **Notes:** Maximum density and arc — the science seat now has a
  *moment* every round (the draw). But it's a major behavior
  change for the seat that feels less "scientist," more "alchemist."

### 10. Worker-placement on the grid

- **Mechanic:** Send workers to action spots; spots block other
  workers; spots pay over time.
- **Source game:** *Lords of Waterdeep*, *Agricola*, *Ark Nova*.
- **Settlement port:** Science gets **2 researcher meeples**. Each
  round place one (or both) on a science card cell. Each cell has
  a placement bonus: top tier = "+1 to a card in this column,"
  bottom tier = "draw 1 tech blind from this column's branch and
  put it on top of an under-card stack." Workers return at end of
  round. Cell is occupied for the round (chief workers and science
  meeples block each other if chief workers ever get sent here).
- **Score:** Fit 4 / Fun 4 / Cplx 3 / Inter 5 / Density 5 / Speed 3.
  Net **24**. Deck-preserved ✅.
- **Notes:** Heavy inter-role pull because the chief's worker
  pool now overlaps with science cells. Fast at the table but
  blocking-overlap rules add complexity. Risk: drifts science into
  domestic territory.

### 11. Tech tree with prerequisites

- **Mechanic:** Branching tree of techs with explicit
  prerequisites; advanced techs unlock from completed prereqs.
- **Source game:** *Twilight Imperium*, *Through the Ages*,
  *Civilization* board game.
- **Settlement port:** Each science card advertises **prerequisite
  cards** (text-printed: "requires Pottery + Mathematics"). The
  lowest-first column rule is replaced by an **explicit DAG**.
  Multiple paths to advanced techs; players plan the order.
- **Score:** Fit 5 / Fun 4 / Cplx 2 / Inter 3 / Density 3 / Speed 4.
  Net **21**. Deck-preserved ⚠ (column rule replaced by
  prereqs; grid optional).
- **Notes:** Heaviest rules cost on the list. Authentic civ feel
  but content authoring becomes a graph problem and rules text on
  every card. Save for a true expansion.

### 12. Innovation-style icon adjacency

- **Mechanic:** Each card prints icons in fixed corners; adjacencies
  in your tableau combine to trigger powers.
- **Source game:** *Innovation*, *Wingspan*'s habitat tracks.
- **Settlement port:** Each science card prints 4 small icons
  (gear, book, scroll, beaker). When you complete a card, slide it
  into one of 4 slots in your **science tableau**. Tableau slots
  *combine* icons across cards: 3 gears in row → +1 contribution
  per round; 3 books → draw an extra tech on next completion.
- **Score:** Fit 4 / Fun 5 / Cplx 3 / Inter 3 / Density 3 / Speed 4.
  Net **22**. Deck-preserved ✅ (overlay on existing cards).
- **Notes:** Overlay shape, plays nicely with #5 and #2. The
  per-turn density is unchanged but the *meaning* of completion
  multiplies. Content cost: small icon strip per card.

### 13. Engine-trigger "when X, then Y"

- **Mechanic:** Cards in tableau with "when other-role does X" or
  "when round ends" triggers.
- **Source game:** *Wingspan*, *Everdell*, *Terraforming Mars*.
- **Settlement port:** Selected blue tech cards print **trigger
  text** (e.g. "When defense places a unit, +1 science to your
  stash" or "When chief flips an event, draw a tech blind from the
  blue column"). Triggers fire automatically; science doesn't even
  need to act. Adds *passive* density across rounds.
- **Score:** Fit 5 / Fun 4 / Cplx 4 / Inter 5 / Density 3 / Speed 5.
  Net **26**. Deck-preserved ✅.
- **Notes:** Same shape as #5 but fired off other roles' moves
  rather than science's own tableau adjacencies. Inter-role 5 —
  every other role's turn now has a chance to make something
  happen for science. Very civ-co-op.

### 14. Open techs to "students"

- **Mechanic:** Pick another player as your "apprentice"; they
  share a benefit you researched.
- **Source game:** *Pandemic* (researcher special action),
  *Spirit Island* (granting powers).
- **Settlement port:** When science completes a card, instead of
  the fixed color → role distribution, science **chooses** which
  role gets each of the 4 under-cards (within constraints — at
  most 2 to one role, at most 1 stays for science). The mapping
  becomes a recurring weighted decision: who needs which tech
  most this round?
- **Score:** Fit 5 / Fun 5 / Cplx 4 / Inter 5 / Density 4 / Speed 4.
  Net **27**. Deck-preserved ⚠ (under-card pile preserved,
  fixed-by-color distribution replaced).
- **Notes:** This is the **single biggest leverage change** in the
  list. Today: completion is a button, distribution is automatic.
  After: completion is a *judgment call* with table-talk implications
  every time. Risks chief-king effect (chief lobbying every round)
  but is mostly a positive co-op pressure.

### 15. Public offer-tile draft

- **Mechanic:** A small public offer of tiles refreshes each round;
  oldest tile auto-discards.
- **Source game:** *Azul* (factory display), *Sagrada* (without
  dice), *Inis*.
- **Settlement port:** Add a **research-tile market** — 4 face-up
  research tokens drawn from a shared bag (mix of resource-shaped
  helpers, +1 hand-size tokens, scout-the-deck tokens). Each round
  science drafts one, pays its small cost. Unbought tiles slide
  one slot left and get discarded off the end. Doesn't touch the
  grid.
- **Score:** Fit 4 / Fun 4 / Cplx 4 / Inter 2 / Density 4 / Speed 5.
  Net **23**. Deck-preserved ✅.
- **Notes:** Pure additive density. Always something fresh on the
  market. Shape is *very* compatible with our current single-tab
  others-phase. Ripples weakly because tiles are mostly
  science-internal.

### 16. Splendor noble visits

- **Mechanic:** Public goal cards reward the first to meet a tableau
  condition (e.g. "3 red gems"); the visit is automatic.
- **Source game:** *Splendor*.
- **Settlement port:** Add **Era Nobles** — 3 face-up condition
  cards revealed at game start (e.g. "Complete 3 green cards →
  +2 happiness to bank, +1 wild token to science"). When science
  meets a noble's condition, claim the reward. Conditions reward
  cross-color play, not just the same column.
- **Score:** Fit 4 / Fun 4 / Cplx 5 / Inter 3 / Density 2 / Speed 5.
  Net **23**. Deck-preserved ✅.
- **Notes:** Trivial rules add. Doesn't move per-turn density much
  (you act normally, the noble fires when condition is met). Best
  used as a content layer on top of one of the higher-density
  ideas.

### 17. Aeon's End / Slay-the-Spire science deckbuilder

- **Mechanic:** Personal deck of action cards; play a hand each
  round; deck cycles.
- **Source game:** *Aeon's End*, *Slay the Spire*, *Dominion*.
- **Settlement port:** Replace the science *role's actions* with a
  small science deck. Each round, draw 5 cards: 2 contribute, 1
  draw, 1 tech-fetch, 1 reservation, 1 wild, etc. Play any number,
  discard rest, refresh next round. Tech-acquire from completing
  grid cards adds new cards into the deck.
- **Score:** Fit 4 / Fun 5 / Cplx 2 / Inter 3 / Density 5 / Speed 3.
  Net **22**. Deck-preserved ⚠ (grid intact, *moves* replaced
  with cards).
- **Notes:** Density-max but heaviest rules cost in the list. Slows
  science to "play hand, resolve effects, decide" — a multi-beat
  turn. Possibly fun, possibly the foreign-style trap (deep but
  slow). Park for an expansion.

### 18. Power-tile take-and-stack

- **Mechanic:** Take a tile from a public offer; stack it on a
  personal mat; stacks score / trigger.
- **Source game:** *Tigris & Euphrates*, *Ark Nova* assoc tiles.
- **Settlement port:** Each completed card rewards a **science
  tile** (in addition to under-card distribution) — tile types
  are *Idea, Tool, Theory, Method*. Science stacks tiles in a
  4-row mat. Each row scores / triggers based on its top tile
  type ("if top is Tool, all defense units get +1 maxHp"). Tiles
  reorder = effects change.
- **Score:** Fit 4 / Fun 4 / Cplx 3 / Inter 4 / Density 3 / Speed 4.
  Net **22**. Deck-preserved ✅.
- **Notes:** Pretty civ. The reorder action gives a per-turn
  beat ("which tile do I push to the top this round?"). Ripples
  through inter-role bonuses.

### 19. Lab specialty / role specialization

- **Mechanic:** Pick a permanent role/asymmetric power at game
  start.
- **Source game:** *Pandemic* (roles), *Race for the Galaxy*
  (homeworlds), *Spirit Island* (spirits).
- **Settlement port:** Science draws / chooses a **lab card** at
  game start: *University* (extra hand), *Workshop* (cheaper
  contributes), *Observatory* (peek next 2 wander cards),
  *Foundry* (auto-grants 1 wild per round). Each gives a small
  permanent kit. Asymmetric across games — replays differ.
- **Score:** Fit 5 / Fun 4 / Cplx 5 / Inter 3 / Density 2 / Speed 5.
  Net **24**. Deck-preserved ✅.
- **Notes:** Doesn't directly increase per-round density, but
  gives the *flavour* of every science game varying. Cheap to
  ship. Pairs with #8 (different lab → different scientist hand).

### 20. Symbol-collection set bonuses

- **Mechanic:** Cards print symbols; collecting 3-of-a-kind / a
  rainbow / a run scores end-game bonuses.
- **Source game:** *Wingspan* end-of-round goals, *Everdell*
  basic events, *Terraforming Mars* milestones/awards.
- **Settlement port:** Each science card prints 1 of 6 symbols
  (gear, book, scroll, plant, beaker, wave). Track running totals
  per-symbol. End-of-round milestone bonuses: "First to 3 gears
  → +2 wild." Endgame: science scores extra contributions for
  the village toward win condition based on symbol diversity.
- **Score:** Fit 4 / Fun 4 / Cplx 4 / Inter 3 / Density 2 / Speed 5.
  Net **22**. Deck-preserved ✅.
- **Notes:** Tiny rules add, slight per-turn weight (you target
  cards for both their tech and their symbol). Like #16, best as
  a content overlay rather than a primary mechanic.

---

## Summary table (sorted by Net)

| # | Idea | Source | Fit | Fun | Cplx | Inter | **Density** | **Speed** | **Net** | Deck preserved |
| - | --- | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 14 | Choose-your-recipient distribution | Pandemic / Spirit Island | 5 | 5 | 4 | 5 | 4 | 4 | **27** | ⚠ |
| 1  | Card-reservation + wild | Splendor | 5 | 4 | 5 | 3 | 4 | 5 | **26** | ✅ |
| 5  | Tech tableau combos | Race for the Galaxy / Wingspan | 5 | 5 | 3 | 4 | 4 | 5 | **26** | ✅ |
| 13 | Engine triggers on others' moves | Wingspan / Everdell / TfM | 5 | 4 | 4 | 5 | 3 | 5 | **26** | ✅ |
| 3  | Multi-card parallel work (escalating) | Through the Ages / Innovation | 4 | 4 | 4 | 4 | 5 | 4 | **25** | ✅ |
| 8  | Scientist-hand action selection | Concordia | 5 | 5 | 3 | 4 | 4 | 4 | **25** | ✅ |
| 7  | Knowledge track | Terra Mystica / TtA | 5 | 4 | 4 | 2 | 4 | 5 | **24** | ✅ |
| 10 | Worker meeples on grid | Lords of Waterdeep / Ark Nova | 4 | 4 | 3 | 5 | 5 | 3 | **24** | ✅ |
| 19 | Lab specialty | Pandemic / Spirit Island | 5 | 4 | 5 | 3 | 2 | 5 | **24** | ✅ |
| 2  | Permanent discount tableau | Splendor | 5 | 4 | 4 | 2 | 3 | 5 | **23** | ✅ |
| 4  | Public offer-row + drift | Suburbia / Ark Nova | 4 | 4 | 4 | 3 | 3 | 5 | **23** | ⚠ |
| 15 | Research-tile market | Azul / Sagrada | 4 | 4 | 4 | 2 | 4 | 5 | **23** | ✅ |
| 16 | Era Nobles | Splendor | 4 | 4 | 5 | 3 | 2 | 5 | **23** | ✅ |
| 6  | Card drafting | 7 Wonders / Sushi Go | 4 | 5 | 3 | 5 | 2 | 3 | **22** | ⚠ |
| 9  | Bag-build research | Quacks / Orleans | 3 | 5 | 3 | 2 | 5 | 4 | **22** | ⚠ |
| 12 | Icon adjacency tableau | Innovation / Wingspan | 4 | 5 | 3 | 3 | 3 | 4 | **22** | ✅ |
| 17 | Science deckbuilder | Aeon's End / StS / Dominion | 4 | 5 | 2 | 3 | 5 | 3 | **22** | ⚠ |
| 18 | Stacking tiles | T&E / Ark Nova | 4 | 4 | 3 | 4 | 3 | 4 | **22** | ✅ |
| 20 | Symbol-collection bonuses | Wingspan / Everdell / TfM | 4 | 4 | 4 | 3 | 2 | 5 | **22** | ✅ |
| 11 | Tech tree DAG | Twilight Imperium / TtA | 5 | 4 | 2 | 3 | 3 | 4 | **21** | ⚠ |

---

## Recommendation — what to test

The top of the list clusters between Net 25–27, and the four 26+
ideas split cleanly into two flavours:

- **Decision moments** (#14, #1, #3, #8) — add new beats *to*
  science's turn.
- **Engine effects** (#5, #13) — add *passive* density across
  every round, fired by the table.

The user's complaint is "one thing and turn is over" — that's an
**active-decision** complaint, so prioritize the first flavour, but
mix in one engine-effect layer so even contribute-only rounds feel
alive.

### Tier 1 — pick one of these as the headline change

1. **#14 Choose-your-recipient distribution** (Net 27). Highest
   impact for the lowest cost. The science *card* mechanic is
   unchanged — only the moment of completion changes. Distribution
   becomes a *real* table decision every time, with chief-domestic-
   defense explicitly asking for cards. Risk: chief lobbying. Cap
   at "max 2 to any one role per completion" to keep it sane.
2. **#1 Card-reservation + wild** (Net 26). Smallest add to ship,
   least risk. Doubles per-turn beats from one to two on most
   rounds (reserve + contribute). The wild token makes a
   reservation feel like real economic agency, not just "claim
   dibs."
3. **#8 Scientist hand** (Net 25). The most "what kind of turn am
   I taking?" of the bunch. Rules cost is a 6–8 card character
   deck plus rotation timing. Worth piloting if #1 + #14 still
   feel underbaked after paper play.

### Tier 2 — one engine layer to bolt on

Bolt **#5 Tech tableau combos** *or* **#13 Engine triggers on
others' moves** under Tier 1. Both turn the previously-inert blue
tech hand into the role's most important asset.

- **#5** if you want science to feel like a *growing tableau* —
  your accumulated learning fires on your own turns.
- **#13** if you want science to feel *engaged with the table* —
  every other role's move can fire your stuff, so you're paying
  attention even when it's not your turn.

The user's "play the village together" preference points at **#13**;
the "I love deck-builders" history (cf. tableau-combo recommendation
in the foreign report) points at **#5**. Both should be tested on
paper; pick whichever reads at the table.

### Tier 3 — content overlays

These are zero-mechanics-cost content adds you can ship at any
time, independently:

- **#2 Permanent discount tableau** — flat +1 line per completed
  card, makes late game feel different.
- **#16 Era Nobles** / **#20 Symbol bonuses** — public goals that
  steer column priority.
- **#7 Knowledge track** — separate "always advancing" track for
  the seat to feel motion every contribute.
- **#19 Lab specialty** — asymmetric setup for replay variance.

### Tier 4 — park

- **#6 Drafting** — too slow at the table for what it adds.
- **#9 Bag-build** — flavour mismatch (science → alchemist).
- **#10 Worker meeples** — strong but encroaches on domestic /
  chief identity.
- **#11 Tech-tree DAG** — high content cost, expansion-level work.
- **#17 Science deckbuilder** — fun-max but slowest, replaces the
  whole role's action set.

### Suggested experiment shape

Build the **#14 + #1 + #13** stack on paper first.

- Each round, science can:
  1. **Reserve** a card (once per game per card; releases when wild
     is consumed).
  2. **Contribute** to any reserved or top-of-column card.
  3. **Complete** (still capped at 1/round in V1) — and on
     completion, *choose* which role gets each of the 4 under-cards.
  4. **Play** a blue tech (now into a tableau, with engine triggers
     on other-role moves).
  5. **Drill / Teach** (D27).
  6. End my turn.

That's three real per-turn beats (reserve, contribute, distribute-
choice) plus a passive engine across the round (#13 triggers).
Removes the "one thing and done" feel without touching the grid,
the tech-under-card pile, or the lowest-first column rule.

If the stack feels heavy after paper play:

- Drop #13 first (it's the easiest to defer — pure content layer).
- If #14 lobbying drama is too much, fall back to today's fixed
  color → role distribution.
- #1 is the cheapest beat to keep; ship it even if the others
  cut.

If the stack feels thin:

- Layer in **#3 Multi-card parallel work** so big-stash rounds let
  science chain two completions at extra cost.
- Add **#8 Scientist hand** for an explicit "what shape is my
  turn" decision.

---

## Open questions (for the next session)

1. **Distribution choice scope.** If we adopt #14, do we let
   science distribute *all 4* cards freely, or only choose which
   role gets the *non-blue* card (with the others fixed by the
   color → role rule)? The cheaper version still moves the needle
   without enabling chief-king lobbying.
2. **Reservation count.** #1: one reservation slot, or two? Two
   slots → reservation is a *resource* you compete for with
   yourself; one slot → reservation is a clean per-round flag.
3. **Tableau slot limit.** #5 / #13: cap the science tableau at
   N cards (force discards), or let it grow forever? Caps create
   decisions; uncapped is simpler but late-game gets silly.
4. **Drill/Teach overlap.** D27 already adds two per-round
   science moves on defense units. With Tier 1 layered on top,
   science's per-round move budget could go from "1 contribute"
   to "1 reserve + 1 contribute + 1 distribute-choice + 1 drill +
   1 teach + 1 tech-play" — that's the opposite end of the
   complaint. Cap the per-round science move count at maybe 3
   (move-budget gating) so density doesn't overshoot.

---

## What this report does *not* recommend

- Deleting the 3×4 grid. The user explicitly likes it.
- Replacing color → role distribution with random distribution.
  (If anything, #14 makes it *more* meaningful.)
- Adding dice anywhere. (Constraint inherited from the foreign
  report.)
- Adding a fail-state for science. (No fail mode, per
  CLAUDE.md.)
- Making science slower per turn. (Speed constraint.)

The science seat already has the strongest *strategic* identity of
any role — they decide who gets what tech. The fix isn't to
restructure that; it's to give them *more to do every round* in
service of that identity. Tier 1 + Tier 2 above is that fix.
