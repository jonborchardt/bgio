# 14 — Playtest follow-ups

Stage 14 is the post-V1 punch list driven by the 2026-04-29 hot-seat
playtest captured in [../notes/playtest-2026-04-29.md](../notes/playtest-2026-04-29.md).
The headline finding from that session: in the default hot-seat
build (also the GitHub Pages demo), the user has no playable action
surface — every role panel short-circuits because the local viewer
has no `playerID`, and the legacy bottom "End my turn" stub is the
only clickable game control. bgio's dev-only debug panel is the only
path to dispatching real moves, and even there `othersPhase` cannot
be advanced because no UI sets `G.othersDone[seat]`.

This stage closes those gaps without re-litigating any of stages 01-13.

## Sub-plans

| Sub-plan | Goal | Touches |
|---|---|---|
| [14.1](14.1-hot-seat-seat-picker.md) | Sticky "Play as: …" tab strip in `Board.tsx` that calls `client.updatePlayerID` so each role panel renders for the chosen seat. Hot-seat becomes single-tab playable end-to-end. | `src/Board.tsx`, `src/ui/layout/`, `src/App.tsx` |
| [14.2](14.2-role-done-buttons.md) | Each non-chief role panel grows a footer "End my <role> turn" button that fires a real `<role>SeatDone` move which flips `G.othersDone[seat]`. Removes the legacy bottom "End my turn" stub from Board. Without this, `othersPhase` cannot advance from any UI. | `src/game/roles/{science,domestic,foreign}/seatDone.ts`, `src/game/moves.ts`, `src/game/index.ts`, role panels, `src/Board.tsx` |
| [14.3](14.3-mode-status-cleanup.md) | StatusBar reads "Hot-seat" / "Networked" / "Spectating" from the actual client mode, not the redacted-spectator detection. CenterMat hides when ChiefPanel is visible (or merges into it). | `src/ui/layout/StatusBar.tsx`, `src/Board.tsx`, `src/App.tsx` |
| [14.4](14.4-circle-editor-multi-resource.md) | ChiefPanel's CircleEditor renders a row per non-zero resource in the bank, not just gold. `chiefDistribute` already accepts any `Partial<ResourceBag>`. | `src/ui/chief/CircleEditor.tsx`, `src/ui/chief/ChiefPanel.tsx` |
| [14.5](14.5-game-over-banner.md) | Reads `ctx.gameover` (the bgio-surfaced `GameOutcome`) and renders a banner / overlay with "Win in N turns" or "Time's up: M settlements joined". | `src/ui/layout/GameOverBanner.tsx` (new), `src/Board.tsx` |
| [14.6](14.6-phase-hints.md) | Inline "what you can do now" line under the StatusBar driven by the (phase, stage, role) triple. | `src/ui/layout/PhaseHint.tsx` (new), `src/Board.tsx` |
| [14.7](14.7-hot-seat-hide-chat.md) | Chat pane + composer render only when `clientMode === 'networked'`. In hot-seat there's no transport, so the composer is a dead UI. | `src/Board.tsx`, `src/clientMode.ts` |
| [14.8](14.8-favicon.md) | Add a small inline PNG / SVG so the dev console stops logging a 404 on every load. | `public/favicon.ico` (new), `index.html` |
| [14.9](14.9-readme-demo-claim.md) | Update README's "Demo at the GitHub Pages URL" line to reflect that hot-seat needs the seat picker (14.1) before it's actually playable. Replace with `npm run dev:full` instructions if the picker doesn't land before the next deploy. | [../README.md](../README.md) |
| [14.10](14.10-foreign-assign-damage-dialog.md) | Real per-round damage absorber UI for the Foreign assign-damage flow. The resolver consumes one allocation per incoming-damage event; the current stub fires a single `[{ byUnit: { [first]: 1 } }]` regardless. | `src/ui/foreign/AssignDamageDialog.tsx`, supporting helpers |
| [14.11](14.11-networked-playtest.md) | End-to-end networked playtest with two browser tabs against `npm run dev:full`: register alice + bob, create a match, both join, drive one full round. Capture findings as a follow-up `notes/playtest-*.md`. Depends on `npm install` having run on the test host so SQLite + concurrently are available. | (no code; produces a notes file) |

## Order

14.1 + 14.2 are the unblockers — without them the game is literally
unplayable from the UI in either build flavor. Land those first.
14.3 / 14.7 are paint-and-polish that should ride along since they
all touch `Board.tsx`. 14.4 / 14.5 / 14.6 widen the chief surface
and add closure UI; pick them up after the round-loop is reachable.
14.8 / 14.9 are trivial. 14.10 is a Foreign-only deepening that
matters once the round-loop demos a battle. 14.11 is the validation
gate after 14.1 + 14.2 land.

## Out of scope (deliberately deferred)

- Replacing the bgio debug panel with a custom debug surface. The
  bgio panel still works in dev and is gated off in production — no
  user-facing harm.
- Mobile-friendly layout. V1 stays desktop-only.
- Migrating the in-memory accounts/runs to SQLite for production.
  The 10.7 V1 stub stands; that's a deploy-time concern that lands
  with stage 13.x's `npm install` step on the live host.
- Backwards-compatible behavior for the legacy bottom "End my turn"
  button. 14.2 removes it; tests update accordingly.

## Validation gate (per sub-plan)

Same gate as EXECUTION.md:
- `npm run typecheck && npm run lint && npm test` green.
- For UI changes: `npm run dev` boots; the changed surface renders
  without console errors; manual smoke matches the sub-plan's
  expected behaviour.
- For 14.11 specifically: `npm run dev:full` brings up server +
  client; two tabs can complete the documented run.
