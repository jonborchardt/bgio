# 02 — Engine: turns, phases, stages, events, randomness, secret state

> **Status: done** (all sub-plans landed; see
> [STATUS.md](STATUS.md) for the canonical per-row state).

## Goal

Model a full round as bgio phases / stages so an empty round runs
chief → others → end-of-round without any role logic yet.

## Scope

**In:**
- Round structure as bgio phases:
  - `chiefPhase` — only the player holding the Chief role acts.
  - `othersPhase` — every non-chief player is set to a stage they can act in
    simultaneously (`activePlayers`), so Science / Domestic / Foreign can
    overlap as game-design.md §General Play allows.
  - `endOfRound` — hook for cleanup, opponent step, win check.
- `turn.order` configured so the Chief seat rotates only if we want it to;
  default = fixed seats per game-design.md.
- bgio `events` enabled (`endPhase`, `endTurn`, `setActivePlayers`) and
  surfaced through typed wrappers so role moves can advance the round.
- Randomness: standardize on `random.Shuffle` / `random.Number` from bgio's
  random plugin. Banned: `Math.random` anywhere in `src/`.
- Secret state: a `playerView` function so each role only sees its own
  hand / deck contents. Public state stays public.
- Per-role "play one event card" hook reserved as a stage that any role can
  enter on demand without ending the round.

## Scope out

- Actual role moves (those live in 04–07).
- Event card content (08).
- Bot driving these phases (11).

## Depends on

01.

## Sub-plans

- [02.1-phase-skeleton.md](02.1-phase-skeleton.md) — define `chiefPhase`,
  `othersPhase`, `endOfRound`, with empty `onBegin` / `onEnd`.
- [02.2-stages-and-active-players.md](02.2-stages-and-active-players.md) —
  non-chief stage map plus helpers to enter / exit a "playing event card"
  interrupt stage.
- [02.3-randomness.md](02.3-randomness.md) — random plugin wiring + ESLint
  rule banning `Math.random`.
- [02.4-secret-state.md](02.4-secret-state.md) — `playerView` implementation;
  helpers for splitting `G` into `public` / `private[playerID]` slices.
- [02.5-end-of-round.md](02.5-end-of-round.md) — `endOfRound` phase that
  calls a list of registered "round-end hooks" so each later module can
  attach one without editing the engine.

## Test surface

- A 2-player game runs: chief acts → both non-chief players act in any order
  → round ends → repeat.
- Calling moves outside the active stage returns `INVALID_MOVE`.
- `playerView` redacts the other player's hand.
- Two games with the same seed produce identical state.
