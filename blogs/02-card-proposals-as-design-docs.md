# Card proposals as JSON design docs

The live decks for Settlement are JSON: buildings, units, technologies,
events, wander cards, science cards, battle cards, trade cards. Each
file has a strict schema, validated at load time. Adding a card to the
live deck is a one-line PR.

But card *design* is not a one-line PR. It's an iterative cut: someone
drafts thirty ideas, three are good, four overlap with cards that
already exist, two depend on engine features that aren't in
[src/game/events/effects.ts](src/game/events/effects.ts) yet. We
needed somewhere to *write down all thirty* — including the bad ones,
because cautionary "don't do this" examples are useful too — without
shipping them.

The answer was a parallel directory: [src/data/proposals/](src/data/proposals/).
Same JSON shape as the live decks, plus two extra fields the live
schema validators would reject:

```json
{ "name": "Aqueduct", "cost": 35, "benefit": "2 food and +2 happiness",
  "note": "Clean water at every fountain.",
  "score": 9,
  "notes": "Iconic civilization building; clean cross-track yield." }
```

The `score` is a 1–10 honest read on whether the card should be cut into
the live deck. The `notes` is one line of design rationale. Eight
proposal files now hold ~800 cards. **None of them are loaded by the
game.** The schema validators in [src/data/schema.ts](src/data/schema.ts)
would throw on the extra fields if anyone tried.

Three things made this work better than a Google Doc:

- **The JSON shape forces concreteness.** A doc lets you write "a card
  that helps Foreign trade more"; the JSON file makes you commit to
  `cost`, `benefit`, and a one-line `note`. Vague proposals don't fit.
- **`score` makes promotion a sortable cut.** The recent commit
  `12d7a95 data: promote 18 score-9 building proposals into live deck`
  was, mechanically, "filter score=9, sanity-check, append". The list of
  what got promoted and what was left on the floor is reviewable in
  diff form.
- **The README documents the bias.** The proposals
  [README.md](src/data/proposals/README.md) is explicit that the score
  distribution skews 5–8 because they're proposals someone thought had
  merit; 1–2s exist as cautionary examples. That tells future-me how to
  read the field without re-deriving its scale.

The deeper bet here is that **design intent and code share a substrate
better than either of them shares with prose.** A proposal that's
already in the same JSON dialect as the live deck is one rename and a
field-strip away from being playable. A proposal in a doc is a
translation step away from anything.
