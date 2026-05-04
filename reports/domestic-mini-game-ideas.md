# Domestic mini-game — alternatives report

**Date:** 2026-05-03
**Scope:** the whole domestic loop is on the table — buy, place, upgrade,
repair, auto-produce, green tech / event, end-turn. Not just adjacency
yields.
**Predecessor:** [defense-redesign-spec.md](./defense-redesign-spec.md) —
its locked decisions (D2 free-form Manhattan-1 grid, D3 center tile, D11
units stacked on building tiles, D15–D17 building HP + repair, D18
unit-side placement bonuses) constrain what's proposable here. New
domestic mechanics must work *inside* that grid and *with* defense's
units-on-tiles model, not against it.

**Bar (per user):** "only entertain largely better ideas." I score
honestly — most candidates do not clear that bar; the few that do are
flagged in §5.

---

## 1. Constraints carried into this report

- **Free-form orthogonal grid stays.** Manhattan-1 adjacency, single-tile
  buildings, anchored at `(0, 0)`. No edge-matching, no hex, no
  polyomino footprints.
- **Building HP + repair is locked.** Damage scaling on yield (D16) and
  the repair sink (D17) are the V1 stash drain. New mechanics layer on
  top, not in place of.
- **Defense places units on building tiles.** Stacking matters,
  placement order matters (D11/D13). Anything that *moves*, *rotates*,
  *replaces* or *temporarily disables* a tile must explain how the
  units sitting on it survive the change.
- **Auto-produce stays.** Yields land in `out` at the start of others-
  phase; the chief sweep is downstream. New mechanics either (a) modify
  the auto-produce computation, (b) add an *active* domestic decision
  on top, or (c) replace the upgrade slot.
- **Tabletop-physical.** No hidden simultaneous arithmetic. Every state
  must have a card / token / pip representation.
- **Bots play domestic by default.** Mechanics need to be enumerable
  (`ai.enumerate`) without a combinatorial blow-up — large branching
  factors per turn are a real cost.
- **Network primary.** Hidden info must be encoded as a face-down card
  the engine can redact.

## 2. Where domestic is today (the baseline being layered on)

A starter hand of every non-tech-gated `BuildingDef`, plus tech-gated
buildings drip in via science completions. Buy → pay stash → place
orthogonally adjacent. Adjacency rules in `adjacency.ts` add yield
bonuses for hand-authored neighbor pairs. A Chief worker on a cell
doubles its yield. Auto-produce sums all of that into `out` each round.
Upgrade is a V1 stub (bumps a counter for ½ gold). Repair (incoming
with defense) restores HP at proportional cost. Green tech and green
event are color-shaped versions of the shared event/tech moves.

Strengths: deterministic, easy to explain at a table, pre-existing
adjacency content, plays clean with auto-produce.

Weaknesses (the ones worth moving on):

- The decision space is mostly *which building to buy next* — once
  bought, placement has only a small adjacency optimisation before the
  grid fills out. Mid-late-game placement is largely "wherever fits."
- Upgrade is a stub; there is no satisfying long-term per-building arc.
- Domestic's pull on **other roles' tech / resources** is small and
  one-directional (tech flows in via science, gold flows in via chief).
  The other direction — domestic actively shaping what defense / chief
  can do — is mostly via the static yields and the static
  `unitMaintenance` / `unitCost` lines on a few buildings.
- Adjacency is *only* a yield bonus. It doesn't trigger active
  abilities, doesn't compound with the defense layer, doesn't condition
  on tech.
- The hand contains *every* starter from turn one — no scarcity, no
  drafting decision.

These are the dimensions the candidates try to move on.

## 3. Scoring rubric (1–5; higher better; max **30**)

| Axis | What "5" means |
| --- | --- |
| **Fit** | Slots inside the locked grid + auto-produce loop without bending other roles. |
| **Fun** | Real decisions, table talk, swing moments. |
| **Complexity** | Comparable to current domestic; learnable in one round; bot-enumerable. |
| **Inter-role** | Pulls on chief gold / science tech / defense unit-tile state — both directions. |
| **Defense-compat** | Plays cleanly with units-on-tiles, building HP, threat pathing. |
| **Speed** | Resolves in seconds inside the parallel others-phase. |

A composite **Net** is the unweighted sum.

The bar I apply for "test this": Net ≥ 25 **and** at least one axis at
5 **and** no axis below 3.

---

## 4. The 20 candidates

Each entry: source mechanic → game it's known from → how it would
replace or augment the domestic loop → score grid → notes / verdict.

### 1. "When placed" trigger effects on each building

- **Mechanic:** Each building card prints a one-time "**On Build**"
  effect that fires the moment it's placed. *Engine-building cascades.*
- **Source game:** *Wingspan* (when-played birds), *Everdell* (purple
  prosperity / construction triggers), *Race for the Galaxy* (windfall
  worlds).
- **How it'd be used:** A new optional `onBuild` field on `BuildingDef`,
  resolved through the existing event-effect dispatcher (already
  shipped for events / techs). Examples a designer can author today:
  *"On Build: gain 2 wood,"* *"On Build: refresh chief's gold event
  hand,"* *"On Build: heal 1 HP on every adjacent building,"* *"On
  Build: defense gains a free Militia in their hand."* Stacks with
  existing yields; doesn't replace them.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 5 | 4 | 5 | 5 | 5 | **29** |

- **Notes:** Cheap to ship — content-only, a small dispatcher hook,
  zero state changes. Solves three problems at once: placement gets a
  swing moment, inter-role pull becomes authorable per card (that's why
  Inter-role = 5), and the design surface for tech-gated content
  widens. Defense-compat is 5 because effects can explicitly *help*
  defense (heal HP, hand a unit) instead of stepping on it. The
  complexity hit is small (one new field on `BuildingDef`), but
  authoring 30+ effects is real ongoing work.
- **Verdict:** **TEST.**

### 2. Phase-tier scaling on buildings (track-aware)

- **Mechanic:** Cards have **eras**; the same card costs / yields
  differently depending on the global phase you're in.
- **Source game:** *Through the Ages* (Age I/II/III tech), *7 Wonders*
  (3-age structure), *Innovation* (Age decks).
- **How it'd be used:** The defense redesign already ships a 10-phase
  global track. Each `BuildingDef` declares an `eraTier` (1–3, mapping
  3-phase-buckets each). A building in your hand becomes **legal to
  buy** only when the track has reached its tier; cheaper if you build
  it in-tier, more expensive if you build it after the track has moved
  past. Optionally: tier-up effects (Granary becomes a Mill in tier 2
  — a small swap action).
- **How "+ to current"**: Today every starter sits in the hand from
  turn one. This adds **temporal scarcity** without a draw / discard
  loop and binds domestic's pacing to the same track the village is
  reading for threats.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 5 | 4 | 4 | 5 | 5 | **28** |

- **Notes:** Makes the global track meaningful to domestic too, not
  just defense. Inter-role rates 4 (not 5) because the pull is mostly
  through the shared track rather than direct tech / gold flow.
  Authoring cost is real but no new mechanic surface — just an `eraTier`
  field per building and a check in `domesticBuy`. Defense-compat is 5
  — completely additive.
- **Verdict:** **TEST.**

### 3. Tag-set synergies

- **Mechanic:** Each building card prints a small set of **tags**
  (e.g. *Civic*, *Production*, *Trade*, *Military*, *Faith*, *Science*).
  Other cards / techs / events score per-tag.
- **Source game:** *Terraforming Mars* (the canonical tag system),
  *Race for the Galaxy* (production worlds × consumer worlds),
  *Hadara*.
- **How it'd be used:** A new `tags: Tag[]` field on `BuildingDef`.
  Adjacency rules and tech effects can read tags instead of (or in
  addition to) `defID`. Example tech: *"+1 gold per Trade building."*
  Example green event: *"This round, Production tags double their
  yield."* Defense unit `placementBonus[]` can also key on tags
  (*"+1 strength on any Military-tagged tile"*) — collapses repetitive
  per-defID author work.
- **How "+ to current"**: Today adjacency rules name a specific
  `defID`. Tags let one rule cover *every Trade building*, drastically
  reducing content-author overhead and making each new building
  immediately interact with everything else.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 4 | 4 | 5 | 5 | 5 | **28** |

- **Notes:** This is mostly a *content authoring* upgrade, but it
  unlocks a lot of mid-game depth without raising rule count. Inter-
  role is 5 because tags travel with the card into defense's bonus
  resolver and into science tech effects. Slight downside: it requires
  going back through `buildings.json` and assigning tags — a
  one-time pass.
- **Verdict:** **TEST** alongside #1; they compose well (an `onBuild`
  effect that reads tags is the natural authoring shape).

### 4. Connectivity / supply lines from center

- **Mechanic:** A built tile only **fully produces** if it has an
  unbroken orthogonal path of placed buildings back to a *trunk* tile
  (here: center). Disconnected tiles produce at a reduced rate or not
  at all.
- **Source game:** *Brass: Birmingham / Lancashire* (link networks),
  *Power Grid* (city connections), *Concordia* (road network).
- **How it'd be used:** At produce time, run a flood-fill from
  `(0, 0)` over occupied cells. Cells in the connected component
  produce normally; isolated cells (orthogonal path interrupted by
  empty cells) produce at half (`⌊yield / 2⌋`) or zero.
- **Defense interaction:** Threats path *toward* center. Domestic's
  natural building shape is "spider arms outward." If defense breaks a
  building (HP→1, yield prorated) **or** the player chose not to
  build a connecting tile, mid-grid pieces go silent until reconnected.
  Repair (D17) is suddenly load-bearing in a new way: repairing a
  midstream building also restores everything *behind* it.
- **How "+ to current"**: Adjacency-1 already encourages clusters. This
  hardens that into a real placement decision (chokepoints!) and gives
  defense damage a *spatial* consequence beyond the prorated yield.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 5 | 4 | 4 | 5 | 5 | **28** |

- **Notes:** A flood-fill is cheap to compute and trivial to visualise
  (paint the connected component a tint). The only real risk is
  early-game frustration if the player accidentally builds an
  unreachable cell — handle by either (a) refusing illegal placements
  or (b) clearly displaying disconnection. I'd ship (a). Defense-compat
  is 5 because it makes defense's job *more meaningful*, not less.
- **Verdict:** **TEST.**

### 5. Adjacency-triggered active abilities (not just yields)

- **Mechanic:** Adjacent buildings unlock **active abilities** beyond
  passive yield bonuses. e.g. *Smithy + adjacent Walls: +1 strength to
  any unit firing from the Walls tile.* *Mill + adjacent Granary:
  domestic may convert 1 wood → 2 food once per round.*
- **Source game:** *Race for the Galaxy / San Juan* phase powers,
  *Castles of Burgundy* tile triggers, *Everdell* construction
  pairings.
- **How it'd be used:** Extend the existing `adjacencyRules` registry
  from `bonus: ResourceBag` to a discriminated union — `kind: 'yield' |
  'unitBonus' | 'activeMove'`. The combat resolver (defense) reads
  `unitBonus` rules at fire time; the domestic stage gets a new
  `domesticTriggerAbility(cellKey)` move for `activeMove` rules.
- **How "+ to current"**: Adjacency is currently flat math. This makes
  it directly bridge into defense's combat math AND give domestic a
  small new active move surface that *only* unlocks when you've placed
  the right neighbours.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 5 | 3 | 5 | 5 | 4 | **27** |

- **Notes:** Highest **Inter-role** rating — this is the one mechanic
  that directly braids domestic's placement decisions into defense's
  fire math. Complexity drops to 3 because the rules registry doubles
  in size and the resolver gets a new lookup, but content-authors
  benefit (one card can describe both a yield buff and a unit buff).
- **Verdict:** **TEST.** Composes especially well with #3 (tags) — an
  active ability keyed on tag instead of defID covers far more pairs.

### 6. Worker-unlocked active building actions

- **Mechanic:** A worker placed on a tile doesn't just double its
  yield — it also unlocks a one-shot **active action** that round
  printed on the building. e.g. *Workshop (worker): convert 2 wood
  → 1 production at start of next round.* *Library (worker): peek the
  next track card.* *Walls (worker): +1 HP on a chosen building.*
- **Source game:** *Lords of Waterdeep* / *Caverna* (worker = action),
  *Architects of the West Kingdom* (cumulative worker placement),
  *Underwater Cities* (place + activate).
- **How it'd be used:** `BuildingDef.workerAction?: ActionDef`. When
  the chief stamps a worker, domestic can spend that worker (in
  addition to / instead of doubling) to fire its action. Cleared
  end-of-round.
- **How "+ to current"**: The worker token currently does one thing
  (double yield). This makes worker placement a *decision* (yield or
  ability?) and pulls the chief's choices into domestic's strategy
  rather than only into yield numbers.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 4 | 5 | 3 | 5 | 5 | 4 | **26** |

- **Notes:** Inter-role = 5 because it forces chief↔domestic table
  talk every round ("place the worker on the Workshop or the Forge?").
  Complexity = 3: each worker action is one-shot per round, but the UI
  has to surface a "spend worker" affordance distinct from "leave
  worker for yield doubling." Defense-compat is 5 (worker actions can
  explicitly help — heal, peek, buff).
- **Verdict:** **STRONG CANDIDATE.** Best when paired with #1 (which
  authoring system overlaps it).

### 7. Pattern-completion district bonuses

- **Mechanic:** When you complete a **pattern** of placed buildings —
  a 2×2 same-tag block, a row of 3 connected, an L-shape of mixed
  tags — you collect a one-time bonus token.
- **Source game:** *Castles of Burgundy* (region completion bonuses),
  *Suburbia* (boroughs), *Sagrada* (pattern dice).
- **How it'd be used:** A small `DISTRICTS` content table:
  `{ shape: PatternMatcher, reward: ResourceBag, oneShot: boolean }`.
  After every domestic placement, scan for newly-completed patterns
  and pay rewards into stash. Patterns can require tags (#3) or be
  shape-only.
- **How "+ to current"**: Today there's almost no payoff for *cluster
  shape* beyond the small adjacency yield. This adds a structural
  choice — am I optimising for the 2×2 or the long line?

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 5 | 3 | 3 | 5 | 4 | **25** |

- **Notes:** The downside is **defense interaction**: a 2×2 cluster of
  high-yield buildings is a fat target for a strength-N threat reaching
  center. The mechanic creates a real tension between "cluster for
  bonuses" and "spread for survivability," which is good design — but
  the bonus has to survive damage events sensibly. Lock: bonuses
  granted *once* at completion (not on-going) avoids "did the bonus go
  away when one tile took damage" headaches. Inter-role is only 3 — the
  patterns are mostly local to domestic.
- **Verdict:** **TEST** if combined with tags (#3). Standalone it's
  only marginally better than current adjacency.

### 8. Card-row drafting market

- **Mechanic:** Replace the "everything in hand from turn one" model
  with a fixed **face-up market row** (e.g. 4 buildings). Domestic buys
  from the row; the row refills from a deck after each buy.
- **Source game:** *Splendor* (gem cards), *Through the Ages* (civic
  row), *Hadara*, *Sushi Go!* (drafting families).
- **How it'd be used:** `G.domestic.market: BuildingDef[]` (size 4),
  `G.domestic.deck: BuildingDef[]` (shuffled at setup). `domesticBuy`
  reads from the market, refilled at end-of-turn. Tech-gated buildings
  shuffle into the deck at the moment science completes (instead of
  appearing in hand for free).
- **How "+ to current"**: Adds **temporal scarcity** and **drafting
  tension**: do I take this Workshop now, or hold gold for the Mint
  that might flip next? Also: tech matters more — late-game buildings
  show up in the market only after their tech lands.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 5 | 4 | 4 | 5 | 5 | **28** |

- **Notes:** Modest mechanical addition (deck + row + refill) for a big
  decision-quality bump. Bot enumeration stays simple (limited to the
  4 visible options). Inter-role is 4 because tech distribution now
  *gates* what shows up in the market, not just unlocks it. Combine
  with #2 (era tiers) and the deck splits naturally into tier sub-decks.
- **Verdict:** **TEST.**

### 9. Permanent improvements / building "ages"

- **Mechanic:** Replace the V1 upgrade stub with **upgrade cards** that
  attach to a placed building, granting it a permanent buff. A
  building can stack 1–3 improvements over the game.
- **Source game:** *Innovation* (icons), *Race for the Galaxy*
  (windfall + production), *Through the Ages* (Age I → Age II tech
  swap).
- **How it'd be used:** `IMPROVEMENTS` content table; each entry has a
  cost, a target tag, and a buff (e.g. `+1 yield`, `+1 maxHp`,
  `+1 range to units stationed here`). `domesticUpgrade(cellKey,
  improvementID)` replaces the stub. Improvements appear in
  `G.domestic.techHand` like other content.
- **How "+ to current"**: Replaces a stub with a real arc. Each
  building has long-term progression beyond the once-and-done buy.
  Strong with defense's HP system — a `+1 maxHp` improvement is
  meaningful immediately.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 5 | 4 | 4 | 5 | 5 | **28** |

- **Notes:** Replaces the stubbed `domesticUpgrade` move with real
  content. The bot AI has to choose where to attach, but the search is
  small (each in-play building × each improvement in hand). Highly
  composable with #5 (active-ability adjacency) and #3 (tags).
  Defense-compat = 5: improvements can specifically deepen unit /
  building defense.
- **Verdict:** **TEST.** This is the cleanest path for fixing the
  long-acknowledged upgrade stub.

### 10. Cumulative discount on repeated build types

- **Mechanic:** Each time you build a tile of a given **tag**, the next
  same-tag building costs less. Stacks within a game.
- **Source game:** *Architects of the West Kingdom* (cumulative virtue
  and silver), *Splendor* (gem discounts), *Anachrony*.
- **How it'd be used:** `G.domestic.tagDiscounts: Record<Tag, number>`.
  After each `domesticBuy`, increment the matched tag's discount by 1
  (cap at 3). `buildingCost` checks the matched tags and applies the
  smallest of the per-tag discounts.
- **How "+ to current"**: Specialisation gets a real reward.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 4 | 4 | 4 | 3 | 5 | 5 | **25** |

- **Notes:** Pleasant snowballing, but inter-role pull is weak (it's an
  internal economy bonus). The one place it shines: combined with
  defense, a "Military-tag specialist" build path becomes a viable
  identity for the village.
- **Verdict:** Skip standalone. Worth folding into #3 (tags) as a
  side-perk.

### 11. Crowding penalty / inverse adjacency

- **Mechanic:** Same-tag tiles next to each other beyond a threshold
  *penalise* yield. Pushes the player to mix.
- **Source game:** *Suburbia* (residential vs commercial flips
  positive/negative as the borough grows), *Castles of Burgundy*
  (terrain over-saturation rules in some expansions).
- **How it'd be used:** Add a `'penalty'` rule kind to
  `adjacencyRules`. Three or more same-tag adjacent tiles trigger a
  small per-extra-cell debit at produce time.
- **How "+ to current"**: Forces variety; counter-pressure to #10.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 4 | 3 | 3 | 3 | 5 | 5 | **23** |

- **Notes:** Rule-count tax for a mostly *blocking* mechanic — players
  feel it as restriction, not opportunity. Better expressed via
  positive #7 (district bonuses for *mixed* clusters).
- **Verdict:** Skip. Not better than the existing flat adjacency.

### 12. Polyomino building footprints

- **Mechanic:** Some buildings occupy 2–3 cells in a fixed shape (line,
  L, T) instead of 1.
- **Source game:** *Patchwork*, *Cottage Garden*, *Bärenpark*, *NMBR
  9*.
- **How it'd be used:** `BuildingDef.footprint: CellOffset[]`.
  `isPlacementLegal` extends to "every offset cell must be empty AND
  the union must touch existing".
- **How "+ to current"**: Spatial puzzling depth.
- **Defense-compat issue:** Defense's units-on-tiles model assumes one
  unit-stack per tile per `cellKey` (D11 / D13). A 3-cell barracks
  would either pick a "primary" tile to host units (loses the
  intuitive "the whole thing is one building" feeling) or split units
  across cells (re-architects defense's per-tile stack rule).
- **Effort:** Touches `grid.ts`, `produce.ts`, the path-walking in the
  defense resolver, and the threat-impact-tile logic. Big.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 3 | 4 | 2 | 3 | 2 | 4 | **18** |

- **Notes:** Cool in principle, expensive in practice, and the
  defense-compat hit is the big one — the user said HP / repair /
  units-on-tiles is "probably locked," and polyominoes are exactly
  what would unlock it the wrong way.
- **Verdict:** **Skip.** Not "largely better" given the defense rework
  cost.

### 13. Dual-use building hand cards

- **Mechanic:** Each card in hand can be **built** (paid cost, placed)
  OR **discarded for resources** OR **played as a one-shot effect**.
- **Source game:** *51st State / Imperial Settlers* (build / produce
  / sell), *Race for the Galaxy* (consume cards), *Glory to Rome*.
- **How it'd be used:** Each `BuildingDef` declares a small
  `discardYield: ResourceBag` and optional `oneShotEffect`. New move
  `domesticDiscardCard(cardName)` and `domesticPlayCard(cardName)`.
- **How "+ to current"**: Hand becomes a multi-purpose currency
  reservoir. Cards never become "stuck in hand" with no use.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 4 | 4 | 3 | 3 | 5 | 4 | **23** |

- **Notes:** Lots of authoring; only marginal real-decision gain over
  the current "buy the building you wanted." Heavy if the hand stays
  large (today: every starter building). Becomes much stronger if
  combined with #8 (drafting market) so the hand is small.
- **Verdict:** Skip standalone. Reconsider as a layer on top of #8.

### 14. End-of-round festival / spend-happiness-for-bonus

- **Mechanic:** Each round-end, optionally spend N happiness for a
  one-shot perk: refresh hand, draw an extra tech, regen +1 HP on
  every building, etc.
- **Source game:** *Brass: Birmingham* (era-end VP), *Catan* festivals
  (variant), *Everdell* feasts.
- **How it'd be used:** Add a happiness resource currency (already in
  `BENEFIT_TOKENS`) sink. New move
  `domesticFestival(perkID)` runs at end-of-others-phase.
- **How "+ to current"**: Today happiness has very limited usage
  (`yieldAdjacencyBonus` doesn't read it; it's mostly a token).

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 5 | 4 | 4 | 4 | 5 | 5 | **27** |

- **Notes:** Solves a quiet problem (happiness doesn't *do* enough)
  without expanding rule count much. Inter-role = 4 because the perk
  menu can pull on chief / science / defense (refresh chief gold
  events, give defense a free Militia, etc.).
- **Verdict:** **TEST** if happiness as a real resource currency is
  desired.

### 15. Worker-rotation / mancala harvest

- **Mechanic:** A *single* worker token starts on a chosen cell each
  round; at produce time it walks N cells along an orthogonal path,
  doubling each tile it passes.
- **Source game:** *Five Tribes*, *Newton*, *Tiny Towns* (sort of).
- **How it'd be used:** Replace the "place worker, double yield"
  worker model with a path-step model.
- **How "+ to current"**: More tactile, more decisions per round.
- **Conflict:** Direct conflict with the chief's worker-placement
  power (D-side: chief stamps workers, that's a chief decision today).
  Stealing it for domestic would require redesigning the chief's
  worker move. Also: bot enumeration grows (every cell × every
  direction × every step length).

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 3 | 4 | 2 | 3 | 4 | 3 | **19** |

- **Verdict:** **Skip.** Cost ≫ benefit; conflicts with chief role.

### 16. Building rubble / razing sink

- **Mechanic:** Domestic can **raze** their own building — refunds half
  the cost into stash and clears the cell. Razed cards go to a
  "rubble" discard pile that other moves (rebuild, scavenge) can read.
- **Source game:** *Imperial Settlers* (raze for resources),
  *Through the Ages* (disband), *Sid Meier's Civ: Expansions* (rebuild
  ruins).
- **How it'd be used:** New `domesticRaze(cellKey)` move. Cell becomes
  empty (and disconnected from the rest of the cluster — interacts
  meaningfully with #4). Rubble pile feeds future "rebuild" tech.
- **How "+ to current"**: Lets the player undo a bad placement. Useful
  for late-game when the early-game shacks are no longer pulling
  weight. Pairs naturally with the defense damage system: razing a
  half-broken building to relocate is a real move.
- **Defense interaction:** Units sitting on the cell when it razes need
  a rule — either they die (harsh, makes raze a real cost) or they
  return to defense's hand (clean, but loses urgency). I'd ship "they
  die" so that razing is a real choice.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 4 | 4 | 4 | 3 | 4 | 5 | **24** |

- **Notes:** Modest improvement; mostly an escape hatch. The one
  case it really shines is mid-late game when the early-tier hand
  filler is dead weight.
- **Verdict:** Borderline. Useful if the grid gets dense enough that
  bad placements actually feel bad. Park behind #2 (era tiers) and
  #8 (market).

### 17. Population track / specialist workers

- **Mechanic:** A separate **population meter** that grows from food
  surplus; spent to recruit non-chief workers (extra worker tokens) or
  to feed defense recruits.
- **Source game:** *Through the Ages* (population from food, feeds
  workers + military), *Civilization*, *Tribes*.
- **How it'd be used:** A `G.population: number` track. Surplus food
  past some threshold each round increments it. Domestic gets a new
  spend ("recruit a worker for chief's pool") and defense gains a
  new gate ("must spend 1 population per unit recruited").
- **How "+ to current"**: Strongest *direct* inter-role pull on the
  list — domestic's food production feeds defense's recruit cap, which
  the chief's worker placement spends.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 4 | 4 | 3 | 5 | 4 | 4 | **24** |

- **Notes:** Inter-role is the strongest 5 on this list. The cost is
  real: a new track, a new spend, a new gate on defense. The defense
  spec already removed upkeep (D14) — adding a population gate
  partially re-introduces a recurring cost the spec deliberately
  retired. That's the wrinkle.
- **Verdict:** **Hold.** Worth a separate conversation about whether
  defense's recruit gate should come *back* in this softer form.

### 18. Tile-completion bonuses keyed on "neighbors of N tags"

- **Mechanic:** When a tile reaches "all 4 orthogonal neighbors
  occupied with at least one tag in common," it grants a bonus
  immediately and permanently.
- **Source game:** *Castles of Burgundy* (region completion),
  *Glen More* (cell scoring), *Suburbia*.
- **How it'd be used:** `BuildingDef.completionBonus?: ResourceBag`.
  At every placement, scan neighbours; if the tile is now "fully
  surrounded with shared tag," fire bonus.
- **How "+ to current"**: Layer on top of #7 (district bonuses) or
  alternative to it.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 4 | 4 | 4 | 3 | 5 | 5 | **25** |

- **Notes:** Very similar to #7. Mostly a flavour difference. Pick
  one of #7 / #18, not both.
- **Verdict:** Pick #7 over this — fewer constraints on cluster shape.

### 19. Hand-passing draft (7 Wonders style)

- **Mechanic:** Each round, the building hand is passed to the next
  seat after a single pick.
- **Source game:** *7 Wonders*, *Sushi Go!*, *Ticket to Ride: Rails &
  Sails* (kind of).
- **How it'd be used:** Domestic's hand gets passed through the seats
  after each pick.
- **Conflict:** This is a 4-human design pattern. Our default is **1
  human + 3 bots** (CLAUDE.md project stance). Drafting against bots
  loses most of the social tension. Also, only one seat actually
  *places* — passing the hand means non-domestic seats are picking
  cards they can never play.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 2 | 3 | 3 | 4 | 5 | 4 | **21** |

- **Verdict:** **Skip.** Wrong shape for the game's player-count
  defaults.

### 20. Threat-aware placement (terrain bonuses)

- **Mechanic:** The grid has implicit **terrain types** under each
  cell — high ground, forest, river — that buff certain buildings or
  units. Tiles that look at their underlying terrain get bonuses.
- **Source game:** *Memoir '44* / *Commands & Colors* (terrain hexes),
  *Tiny Towns* (cell types), *A Feast for Odin* (terrain board).
- **How it'd be used:** Pre-seed each grid cell with a terrain card
  face-down at setup; flipped when first occupied. Building yields /
  unit ranges read terrain.
- **Conflict:** Free-form placement on an empty grid means terrain
  cells must be *predefined for every coordinate* — but the grid is
  effectively unbounded. Bounding the grid (say 7×7) is a structural
  change, and the defense spec doesn't want that. Without a bounded
  grid, terrain doesn't ergonomically fit at the table.

| Fit | Fun | Complexity | Inter-role | Defense-compat | Speed | **Net** |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 2 | 4 | 2 | 4 | 4 | 3 | **19** |

- **Verdict:** **Skip.** Requires bounding the grid; not worth the
  rework.

---

## 5. Summary table & verdict

| # | Idea | Net | Verdict |
| :-: | --- | :-: | --- |
| 1 | "On Build" trigger effects | **29** | **TEST** |
| 2 | Phase-tier scaling | **28** | **TEST** |
| 3 | Tag-set synergies | **28** | **TEST (compose with #1, #5)** |
| 4 | Connectivity / supply lines | **28** | **TEST** |
| 8 | Card-row drafting market | **28** | **TEST** |
| 9 | Permanent improvements (real upgrade) | **28** | **TEST** |
| 5 | Adjacency-triggered abilities | **27** | **TEST** |
| 14 | Festival / happiness sink | **27** | TEST if happiness becomes real currency |
| 6 | Worker-unlocked active actions | **26** | Strong; pair with #1 |
| 7 | Pattern-completion districts | **25** | Test only with tags (#3) |
| 10 | Cumulative tag discounts | **25** | Fold into #3 |
| 18 | Tile-completion bonuses | **25** | Pick #7 over this |
| 16 | Raze / rubble sink | **24** | Hold; useful late |
| 17 | Population track | **24** | Hold; talk to defense first |
| 13 | Dual-use hand cards | **23** | Only on top of #8 |
| 11 | Crowding penalty | **23** | Skip |
| 19 | Hand-passing draft | **21** | Skip — wrong player count |
| 12 | Polyomino footprints | **18** | Skip — defense rework cost |
| 15 | Worker mancala | **19** | Skip — conflicts with chief |
| 20 | Terrain types | **19** | Skip — needs bounded grid |

## 6. Suggested test list (the "largely better" ones)

If only one bundle gets tested, this is it. The seven Net-≥27 ideas are
**not** equally weighted — they're listed below in the order I'd ship.
The first three compose into a single coherent design upgrade; the rest
are independent enhancements.

### Priority A — ship together as the "domestic v2" core

Each is small on its own; together they recompose how a built tile
*means* something to the rest of the table.

1. **Tag-set synergies (#3).** Foundation. Pure data work — add a
   `tags: Tag[]` field to `BuildingDef`, do a one-time pass over
   `buildings.json`. Unlocks every other mechanic that wants to read
   "Trade buildings" or "Military buildings" as a group. Defense's
   `placementBonus[]` and adjacency rules both immediately benefit.
2. **"On Build" trigger effects (#1).** Pure content layer on top of
   #3 — `BuildingDef.onBuild?: EffectDef`, dispatched through the
   existing event-effect pipeline. Each new building becomes a small
   moment instead of a quiet stat bump.
3. **Permanent improvements / real upgrade (#9).** Replaces the
   long-stubbed `domesticUpgrade`. Improvement cards reference tags
   from #3 and effects from #1, so this is a *content* extension of
   the same authoring system, not a new mechanic.

### Priority B — independent enhancements, pick freely

4. **Connectivity / supply lines (#4).** Single best inter-role
   spatial mechanic on the list — gives defense's damage a real
   network consequence, gives domestic a chokepoint decision, gives
   repair (D17) a second-order payoff. Standalone change to
   `produce.ts` (flood-fill) and the placement legality check.
5. **Phase-tier scaling (#2).** Binds domestic to the global track
   without inventing a new track. Tiny mechanical change (one field
   + a buy-time check).
6. **Card-row drafting market (#8).** Adds drafting tension; makes
   tech distribution feel meaningful in domestic specifically. Best
   shipped together with #2 so the deck splits naturally by tier.
7. **Adjacency-triggered active abilities (#5).** Strongest direct
   bridge to defense — once tags (#3) exist, a `placementBonus`
   keyed on tag instead of `defID` collapses huge amounts of repeated
   authoring into one rule. Worth shipping after the Priority A
   bundle has settled.

### Worth a separate conversation

- **Festival / happiness sink (#14)** — only if happiness graduates to
  a first-class currency. It's currently an underused token; this
  would justify it.
- **Population track (#17)** — strongest *direct* inter-role pull on
  the list, but partially reverses defense's D14 (no upkeep). Wants
  user input on whether to bring back a softer recurring cost.
- **Worker-unlocked actions (#6)** — best as a follow-up after #1 is
  authored, because the worker action and the "On Build" effect share
  an authoring shape.

## 7. Open questions for the user

1. **Tags first?** Most of the strongest ideas read tags. If we agree
   #3 lands, the others compose for free. Otherwise each becomes its
   own bespoke matcher. Confirm direction before I start writing
   sub-plans.
2. **Happiness as real currency?** Idea #14 only makes sense if you'd
   accept a small economy where happiness gets spent. Otherwise drop it.
3. **Population track vs. no-upkeep?** Defense's D14 says no upkeep.
   Idea #17 walks a softer version back in. Off the table?
4. **Era tiers — number of tiers?** Idea #2 is cleanest with **3
   tiers** mapped onto the 10-phase track (phases 1–3, 4–7, 8–10).
   Other splits work; flag if you want a different shape.
5. **Connectivity strictness.** Idea #4 — half-yield on disconnect, or
   zero? My instinct says half (less punishing while still meaningful).

---

Net: the **A bundle (#3 + #1 + #9)** is the single highest-leverage
play. It's mostly content authoring, fits inside the locked grid, and
doesn't touch defense's rework. Of the B group, **#4 (connectivity)**
is the most uniquely *good* mechanic — the others are good
optimisations, but #4 is the one that genuinely changes how the
village feels in space.
