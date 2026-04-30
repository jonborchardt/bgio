# 03 — Resources & center mat

> **Status: done** (all sub-plans landed; see
> [STATUS.md](STATUS.md) for the canonical per-row state).

## Goal

Model every token (gold, wood, stone, steel, worker, horse, …), the central
bank, and the per-player circles on the center mat — the substrate every role
acts on.

## Scope

**In:**
- `Resource` enum / string-literal union covering all tokens listed in
  game-design.md §Tokens, with room for expansion-only tokens.
- `Bank` — single resource bag held centrally.
- `CenterMat`:
  - One "circle" per non-chief player. Chief drops resources here; the
    target player can pull from their own circle freely.
  - One "trade request" slot (Foreign places these; Chief can discard).
- Pure helpers (no bgio):
  - `give(state, from, to, resources)` with overflow / underflow checks.
  - `canAfford(holder, cost)`.
  - `pay(holder, cost)`.
- Move set surfacing these helpers: `chiefDistribute`, `pullFromMat`,
  `payToBank` (used by Domestic upkeep and Science purchases later).
- Round-end hook (registered via 02-engine/05) that empties leftover circles
  back to the bank, per game-design.md §Chief.

**Out:**
- Any role-specific spending (each role's stub owns its own moves that *use*
  these helpers).
- Worker placement rules (Chief stub).

## Depends on

01, 02.

## Sub-plans

- [03.1-token-types.md](03.1-token-types.md) — define `Resource`,
  `ResourceBag`, and guard helpers.
- [03.2-bank.md](03.2-bank.md) — bank slice + tested transfer primitives.
- [03.3-center-mat.md](03.3-center-mat.md) — circles + trade-request slot;
  round-end sweep hook.
- [03.4-moves.md](03.4-moves.md) — `chiefDistribute` and `pullFromMat` moves
  wired into the engine, with stage-aware permission checks.

## Test surface

- Bank conservation: total tokens never drift across any sequence of valid
  moves.
- Underflow attempts return `INVALID_MOVE` and leave state unchanged.
- Circle-to-player transfer is one-way (player → bank requires an explicit
  pay move, not a reverse pull).
- Round-end hook clears leftover circle contents back to the bank.
