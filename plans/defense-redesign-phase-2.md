# Phase 2 — The track, defense moves, science moves, win condition

**Source spec:** [reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** [phase-1](./defense-redesign-phase-1.md) (Phase 1 must be merged before Phase 2 starts.)

## What this phase does

Phase 2 is the **mechanics build**. It puts the new system on top of
the scaffolding from Phase 1:

- Builds the **Global Event Track** — content, deck, phases,
  telegraphing.
- Adds the **`chiefFlipTrack`** move and the **path / fire / impact**
  resolver.
- Adds **Defense moves**: `defenseBuyAndPlace`, `defensePlay`
  (red-tech: unit upgrades + track manipulation), `defenseSeatDone`.
- Adds **Science moves**: `scienceDrill`, `scienceTeach` (D27).
- Adds the new **win condition**: boss card resolution.
- Wires the new round shape: chief → flip/resolve → others mitigate.
- Adds bots for Defense.

After Phase 2, the game is **fully playable in headless / hot-seat**
on the new design. UI lands in Phase 3 — the existing role panels
might be ugly during Phase 2's life, but the moves are all
dispatchable.

## What this phase does NOT do

- No new UI components (`Phase 3`). Existing panels render whatever
  they can; new moves dispatch from a developer-style debug
  interface or via tests until Phase 3 lands a proper UI.
- No new content beyond what's required to playtest. Specifically:
  the track ships with placeholder card content; tuning is a later
  pass.

## Sub-phases (initial breakdown — to be expanded in their own files)

1. **2.1 — Track schema + content loader.** New `TrackCardDef`
   schema, new `trackCards.json`, new loader in `src/data/index.ts`.
   Schema covers threat / boon / modifier card kinds, direction +
   offset for threats, strength, optional reward, boss thresholds.
2. **2.2 — Track state on `G`.** `G.track`: `{ deck, current, next,
   phaseIndex, history }`. Setup builds the track from the 10 phase
   piles in order (each pile shuffled). The `next` slot drives
   telegraphing.
3. **2.3 — `chiefFlipTrack` move + resolve algorithm.** The path /
   fire / impact / center-burn pipeline from spec §3 + §4. Pure
   functions where possible so they're unit-testable. The move
   appends to `bankLog` for any center burn.
4. **2.4 — Round shape + phase wiring.** Update `phases/chief.ts`
   so `chiefSeatDone` triggers `chiefFlipTrack` automatically (or
   require it as the last chief move). Update `phases/others.ts` to
   start *after* the flip.
5. **2.5 — Defense moves.** `defenseBuyAndPlace` (cost from stash
   → push unit instance onto a building tile), `defensePlay` (red
   tech: unit upgrade or track modifier), `defenseSeatDone`. Bot
   `ai.enumerate` for defense (greedy: place units against the
   telegraphed next card).
6. **2.6 — Science moves (D27).** `scienceDrill`, `scienceTeach`.
   Skills content table. Resolver integration so taught skills /
   drill markers apply at fire time.
7. **2.7 — Boss + win condition.** Boss card schema (three
   thresholds + base attacks). New `endIf` that returns "win" when
   the boss resolves successfully. `onEnd` records a score (rounds
   taken, HP retained, etc.).
8. **2.8 — Round-end + cleanup hooks.** Drill marker clear, regen
   apply, taught-skills persistence (no-op — they're durable),
   per-round flag resets. End-of-round event-effect dispatches.

Ordering: schema (2.1) → state (2.2) → resolve (2.3) → phase wiring
(2.4) → defense moves (2.5) → science moves (2.6) → boss + win
(2.7) → end-of-round hooks (2.8). Each sub-phase is testable on its
own; the headless test client stays the source of truth.

## Exit criteria for Phase 2

- A 4-bot game completes from setup to either "boss resolved" (win)
  or `turnCap` (time up) without errors.
- Center burns post to `bankLog` and split correctly across non-chief
  seats.
- Drill markers consume on fire; taught skills persist across
  rounds.
- Boss thresholds correctly chip attacks based on completed science
  cards / bank gold / unit strength sums.
- Hot-seat UI shows the moves are dispatchable (even if rendering is
  rough — that's Phase 3).

## Risks / open spots flagged for sub-phase planning

- **Path geometry** for the resolve algorithm — the free-form
  domestic grid means buildings can sit anywhere. Decide whether
  the path is a single line (one tile per row going toward center)
  or whether a "miss" tile is permitted. Spec §3 says single-line;
  that's the default.
- **Bot for science Drill / Teach** — naive bot can pick the unit
  with the highest current strength. Risk: bot wastes Drill on a
  unit that won't fire next round. Mitigation: only Drill / Teach
  when there's at least one unit covering the telegraphed next
  card's path.
- **Race between chiefFlipTrack and other chief moves** — make sure
  flip can only run after `chiefSeatDone` (or replace
  `chiefSeatDone` with a flip-then-end behavior).
- **Track exhaustion edge case** — what if the track empties without
  the boss having flipped? Shouldn't happen with the boss as the
  last card, but assert it.
