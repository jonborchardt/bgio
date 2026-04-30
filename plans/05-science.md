# 05 — Role: Science

> **Status: done** (all sub-plans landed; see
> [STATUS.md](STATUS.md) for the canonical per-row state).

## Goal

Implement game-design.md §Science: science-card grid, partial payments toward
requirements, completion, and tech-card distribution to the right roles.

We start with the **simplest viable option** from game-design.md §Science
(Option 1, 3×3 grid, costs are flat resource sums) and design so other
options can slot in later. The user has explicitly reserved the right to
swap to Option 1b / 2 / 3 — keep the grid module isolated enough that
swapping the *grid generator* + *cost gating* is a matched-pair edit, not
a rewrite.

## Scope

**In:**
- Setup: build the 3×3 grid by tier (beginner, intermediate, advanced),
  shuffled per pile, with 4 random tech cards under each science card.
  Reads source data from [technologies.json](../src/data/technologies.json).
- State: per-card `paidResources` ledger and `completed` flag.
- Move: `scienceContribute(scienceCardID, resources)` — pay from circle into
  the card's ledger. Enforces "lowest number first per color" rule.
- Move: `scienceComplete(scienceCardID)` — when ledger ≥ requirements, mark
  complete, distribute the four tech cards underneath:
  - red → Foreign hand, gold → Chief, green → Domestic, blue → Science.
- Move: `sciencePlayBlueEvent(cardID)` — placeholder, see 08.
- Round-end hook: enforce "may complete only 1 a turn" by resetting a
  per-round counter.

**Out:**
- Tech card *effects* (those live in role stubs that consume the cards).
- Options 1b / 2 / 3 — design left open. Add as sub-plans only if Option 1
  proves boring in playtests.

## Depends on

01, 02, 03.

## Sub-plans

- [05.1-grid-setup.md](05.1-grid-setup.md) — build 3×3 grid from JSON,
  attach tech cards underneath.
- [05.2-contribute-move.md](05.2-contribute-move.md) — partial payments;
  lowest-first rule.
- [05.3-complete-move.md](05.3-complete-move.md) — completion + reward
  distribution.
- [05.4-event-stub.md](05.4-event-stub.md) — `sciencePlayBlueEvent`
  skeleton.
- [05.5-panel.md](05.5-panel.md) — Science UI: grid view, requirement bars,
  contribute / complete buttons.

## Test surface

- Cannot contribute to a non-lowest card in a color until lower ones are
  complete.
- Contributions never exceed requirement and never deduct unaffordable
  resources.
- Completion atomically distributes exactly four tech cards.
- Per-round completion counter resets at `endOfRound`.
