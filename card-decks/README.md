# Card-deck rewrite proposals

Five independent rewrites of the four card decks (`buildings.json`, `units.json`,
`technologies.json`, `events.json`), each pursuing a different design goal.

Each subfolder is a drop-in candidate replacement for `src/data/*.json` and
ships a `REPORT.md` explaining the design goal, the diff against the current
deck, and why this set is better for that goal. **No code changes** — only
new content.

| # | Folder | Design goal in one line |
|---|---|---|
| 1 | `01-lean-and-mean` | Cut ~40-50% of cards; every card has a distinct identity. |
| 2 | `02-iron-frontier` | Strip post-apocalyptic theme drift; all cards fit a coherent Iron-Age frontier. |
| 3 | `03-synergy-engine` | Placement-bonus + combo heavy; spatial play matters. |
| 4 | `04-color-balanced` | Redistribute scienceColor so all four boss-debuff thresholds are reachable. |
| 5 | `05-tier-curve-calibrated` | Regenerate every cost by formula; costs predictable from stats. |

These are independent — picking one doesn't preclude later borrowing flavor or
balance from another. Reports include the math / curves where relevant so a
reviewer can sanity-check before authoring tests.
