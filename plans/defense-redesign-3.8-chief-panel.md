# Sub-phase 3.8 — Chief panel update (Flip Track button)

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §6, D22 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 3.1 + 3.3 merged (the strip and the path overlay
respond to the flip).

## Goal

Add a prominent "Flip Track" button to the chief panel that
becomes available after the chief's other actions are done and
that gates `chiefSeatDone`. The flip is a visible table moment —
the button should feel deliberate.

## Files touched

- `src/ui/chief/ChiefPanel.tsx` (existing — additive edit).
- `src/ui/chief/FlipTrackButton.tsx` (new).
- `src/theme.ts` — chief accent (`palette.role.chief`) reuse.

## Behavior

- Button is **prominent** — large, distinctive, sits at the
  bottom of the chief panel where the seat-done button is.
- **Disabled** until the chief has at least had a chance to
  distribute (or maybe always enabled — chief can flip first if
  they want; the spec doesn't forbid it). Recommend always
  enabled, with a confirmation tooltip if pressed before any
  distribution.
- Clicking dispatches `chiefFlipTrack`. The card flips, resolves,
  the path overlay plays.
- After flip, the button re-labels to "End my phase" (or shows a
  separate seat-done button).
- `chiefSeatDone` is **disabled** until `track.flipDone === true`;
  show an inline error message if pressed too early.

## UX notes

- A pulse animation on the button when chief has done their
  distribution work and the only thing left is to flip — gentle
  prompt, not a flashing-red demand.
- The flip causes a strip animation + path overlay simultaneously
  (handled by 3.1 + 3.3); the chief panel itself just dispatches.

## Tests

- Button dispatches `chiefFlipTrack`.
- Disabled state when `track.upcoming.length === 0` (boss already
  resolved or track exhausted).
- `chiefSeatDone` button is disabled until flip happens.
- Inline error when seat-done is pressed early.

## Out of scope

- Animation polish (3.9 polishes everything).
- Chief's other moves (distribute / place worker) — unchanged.

## Done when

- Chief seat can flip the track via the panel.
- Round shape (chief → flip → others) is enforced visually as well
  as in state.
- Tests pass.
