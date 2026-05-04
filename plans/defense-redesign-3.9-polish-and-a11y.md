# Sub-phase 3.9 — Polish, accessibility, e2e

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §10 (all UI bullets) in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** All of 3.1–3.8 merged.

## Goal

Final polish pass and end-to-end coverage. Tighten animations,
ensure accessibility, run the e2e smoke suite against the new
UI, fix any visual inconsistencies that surface across full play.

## Tasks

### Tooltips

- Every new icon (kind, direction arrow, drill star, taught-skill
  tag, HP pip, threshold ✓/✗) has a tooltip with plain-English
  explanation.
- Tooltips use MUI's `Tooltip` with consistent placement.

### Keyboard navigation

- TrackStrip cards focusable; arrow-keys move between past /
  current / next.
- Defense hand and tech row focusable; Enter selects, Esc
  cancels.
- TeachDialog and UnitPicker fully tab-traversable.
- The Flip Track button has a keyboard shortcut hint (e.g. F).

### Color-blind safe palette

- All "met / unmet" indicators (boss thresholds, HP pip color)
  use **shape + color**, never color alone.
- Run a manual test with a color-blindness simulator.
- Confirm `palette.status.healthy` / `warning` / `critical`
  colors hit at least Wong-palette accessibility.

### Animation budget

- Path overlay ≤ 500 ms total.
- Damage / repair flash ≤ 250 ms.
- Track-strip slide ≤ 250 ms.
- No animation blocks input — all use transforms / opacity, not
  layout.

### E2E smoke

- Update `tests-e2e/` Playwright smoke test to drive a full
  hot-seat game with 1 human + 3 bots through to a boss outcome.
- Assert: track strip animates, defense panel renders
  placements, science drills at least once, end-screen shows
  win/loss outcome.

### Visual consistency

- Walk every panel in hot-seat; confirm spacing / typography are
  consistent with the existing role panels.
- Confirm no raw hex literals slipped in (lint rule).

### Performance check

- A full match of 30 rounds with 4 bots completes in the dev
  server in ≤ 2 minutes (rough sanity ceiling — much faster on
  real hardware).
- React DevTools profiler: no panel re-renders > 16ms in steady
  state.

## Tests

- Existing component tests still pass.
- E2E smoke test passes for a full match.
- `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run e2e:smoke`, `npm run build` all green.

## Done when

- The game is shippable as the new design — a non-developer can
  open the hot-seat client and play a full match start to finish
  without confusion.
- All UI requirements in spec §10 are met.
- Phase 3 is closed; the redesign is live.

## Phase 3 closeout

After 3.9 merges, the defense redesign is complete. Suggested
follow-ups (separate plans, not Phase 3):

- **Content tuning pass** — boss thresholds, phase-pile difficulty
  curve, building maxHp values, unit costs / ranges.
- **Networked-mode validation** — drive a 4-human-equivalent run
  through the SocketIO server end-to-end.
- **Bot improvement** — replace the greedy defense / science
  enumerators with MCTS-driven scoring.
- **Big science redesign** that the user has queued — the
  Drill / Teach moves from D27 are deliberately small enough to
  retire or reshape inside that future redesign.
