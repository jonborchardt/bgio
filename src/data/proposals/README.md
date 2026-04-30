# Card Proposals

Proposed expansions for each card type. **These files are NOT loaded by the
game** — they are reading material for design review. The schema validators
under `src/data/schema.ts`, `decks.ts`, `events.ts`, `wanderCards.ts`, and
`scienceCards.ts` would reject the extra `score` and `notes` fields if these
were imported as live content.

## Files

- `buildings.proposals.json` — 100 building proposals (Domestic).
- `units.proposals.json` — 100 unit proposals (Foreign).
- `technologies.proposals.json` — 100 tech card proposals (cross-role hand cards).
- `scienceCards.proposals.json` — 100 science-card proposals (Science grid).
- `events.proposals.json` — 100 event-card proposals (per-color hand cards).
- `wanderCards.proposals.json` — 100 wander/opponent-deck proposals.
- `battleCards.proposals.json` — 100 battle-card proposals (Foreign deck).
- `tradeCards.proposals.json` — 100 trade-request proposals (Foreign deck).

## Score field

Every proposed card has a `score` integer 1–10 and a one-line `notes`
field. The score is my honest read on whether the card should be cut into
the live decks:

- **9–10 — Strong yes.** Fills a real gap, mechanically distinct, balance
  is in the right ballpark. Take these first.
- **7–8 — Likely yes.** Useful and well-shaped, but redundant with
  another proposal or borderline on cost. Pick the better of two siblings.
- **5–6 — Maybe.** The idea is fine but the slot is crowded, or the card
  is a vanilla number bump. Include only if the deck still has room after
  the higher-scored picks.
- **3–4 — Probably skip.** Strictly weaker than another card, or solves a
  problem the engine already handles cleanly.
- **1–2 — Skip.** Broken, contradictory, or dependent on systems that
  don't exist in the bgio engine yet (e.g. asks the dispatcher for a
  `kind` not in `events/effects.ts`).

The bias overall is toward 5–8 because I'm proposing things I think have
some merit; cards rated 1–2 are deliberately included as cautionary
"don't-do-this" examples so the deck doesn't drift into them by accident.

## Design stance

- **No fail mode.** Pressure cards (negative wander, harsh failure
  tributes) degrade outcomes — they don't trigger a loss. See CLAUDE.md
  "Project stance".
- **Network-first.** Cards assume per-player views. Nothing here exposes
  hidden info to the table.
- **Engine-respecting.** Every event/wander effect is one of the kinds in
  `src/game/events/effects.ts` (`gainResource`, `doubleScience`,
  `forbidBuy`, `forceCheapestScience`, `swapTwoScienceCards`,
  `redrawBattleTop`, `tributeWaiver`, `addEventCard`, `awaitInput`).
  Anything outside that union is flagged in `notes`.
- **Codename "Settlement".** Card names avoid leaning on the codename so
  a future rename pass is cheap.
