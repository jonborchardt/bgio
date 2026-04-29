# 14 — Playtest follow-ups

> **Status: pending** (none of the 11 sub-plans started; see
> [STATUS.md](STATUS.md) for the canonical per-row state).
> 14.1 + 14.2 are the unblockers.

Stage 14 is the post-V1 punch list driven by the 2026-04-29 hot-seat
playtest. The original `notes/` directory has been deleted; the full
session context is preserved below so this plan stands on its own.

## Headline finding

In the default hot-seat build (also the GitHub Pages demo), the
user has no playable action surface — every role panel short-circuits
because the local viewer has no `playerID`, and the legacy bottom
"End my turn" stub is the only clickable game control. bgio's
dev-only debug panel is the only path to dispatching real moves,
and even there `othersPhase` cannot be advanced because no UI sets
`G.othersDone[seat]`.

The networked build was not exercised in this session — see 14.11.

## 2026-04-29 hot-seat playtest — packed session log

Driven through Playwright MCP against `npm run dev` at
`http://localhost:5179/`. No fixes were made during the session.

### Step-by-step

1. **Opened `/`.** Title "Settlement", header "Player 1's turn".
   Four "Player N: <role>" info rows. Three "Seat 2 / Seat 3 / Seat 4"
   CenterMat circles. Status bar:
   `Phase chiefPhase · Current Player 1 · Round 0 · Mode Spectating`.
   Chat: "No messages yet." + composer. bgio debug panel mounted on
   the right (dev-only). **No role panel visible.** Nothing to click
   that does game stuff.
2. **Clicked bgio-debug "PLAYERS: 0".** ChiefPanel appeared:
   "Chief", "Bank ● 3", three CircleEditor rows for seats 2/3/4
   with `+1 / +2 / +5` gold buttons, "END MY TURN" inside the
   panel. Status bar dropped the "Mode Spectating" tag. Legacy
   bottom "End my turn" button also visible — **two separate
   "End my turn" buttons** on screen. The standalone CenterMat
   row stayed under ChiefPanel duplicating the circle info.
3. **Clicked `+1` on Player 2's row.** Bank `3 → 2`, circle for
   seat 2 `0 → 1`, mat shows "Seat 2: Gold: 1". Move dispatch works.
4. **Clicked the chief panel's "END MY TURN".** Phase advanced
   `chiefPhase → othersPhase`, `Current Player 2`. Engine works.
   ChiefPanel disappeared correctly (chief in `done` stage).
   Bottom "End my turn" stub still enabled. **No SciencePanel
   rendered** — local viewer (still bgio-debug-Player 0) doesn't
   hold the science role; no in-app way to swap.
5. **Tried to click bgio-debug "PLAYERS: 1" → wiped the game.**
   Two buttons share text `"1"`: bgio's CONTROLS row
   (`reset (shortcut: 1)`) and the PLAYERS row. The click hit
   reset first and state reverted to fresh. bgio's stock debug
   UI, not our bug — but it's the only seat-switching affordance
   and it ships off in production.

### Blocking issues

- **B1. Hot-seat = spectator by default.** `src/App.tsx`
  HotSeatApp wires `Client({ ... })` with no `playerID`. Each role
  panel starts with `if (!playerID) return null`. → 14.1.
- **B2. No way to act in `othersPhase` from a single tab.**
  `othersPhase` pins each non-chief seat to its own stage; bgio
  rejects moves from a non-active seat. → 14.1 + 14.2.
- **B3. `Mode: Spectating` is wrong in hot-seat.** Board uses
  `playerID == null` to decide spectator; hot-seat isn't
  watching, it's playing all seats. → 14.3.
- **B4. Production build has no debug panel and no lobby.** `12.2`
  gated bgio's panel on `import.meta.env.DEV`. Production GH
  Pages bundle has zero action surface. → 14.1 unblocks; 14.9
  updates the README claim.

### Visual / UX issues

- **V1. Two "End my turn" buttons during chiefPhase.** → 14.2.
- **V2. Static role-assignment list duplicates engine state.**
  Top four rows are pure info, never react. Cosmetic; deferred.
- **V3. CenterMat duplicates ChiefPanel circle info.** → 14.3.
- **V4. CircleEditor only exposes gold.** → 14.4.
- **V5. No "what's my next legal action" hint.** → 14.6.
- **V6. No game-over or summary view.** `ctx.gameover` is unused.
  → 14.5.
- **V7. bgio debug "1" button collides with reset shortcut.**
  Can't fix bgio; move seat-switching out of bgio's panel. → 14.1.
- **V8. Chat composer wired in hot-seat with no transport.**
  → 14.7.
- **V9. Missing favicon — 404 on every load.** → 14.8.
- **V10. Status bar overlaps role-assignment box at narrow
  widths.** Minor; tighten in 14.3 if convenient.

### Engine / model issues

- **E1. Cannot drive a real round to completion via the UI.**
  No UI flips `G.othersDone[seat]`. The test-only
  `__testSetOthersDone` was the only thing that did; review fix
  #1 gated it behind `NODE_ENV=test`. → 14.2 ships real
  `<role>SeatDone` moves.
- **E2. Foreign AssignDamageDialog stub.** Auto-allocates 1 to a
  single unit regardless of battle shape. → 14.10.
- **E3. ProductionMoves now omit `__test*` (review fix #1).**
  Security improvement that surfaces the E1 round-loop UI gap.
  → 14.2.

### Outside-the-app issues

- **O1. README "Demo at the GitHub Pages URL" is misleading.**
  Visitors get a page with no controls. → 14.9.
- **O2. Lobby + auth not validated end-to-end.** → 14.11.

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
| [14.11](14.11-networked-playtest.md) | End-to-end networked playtest with two browser tabs against `npm run dev:full`: register alice + bob, create a match, both join, drive one full round. Capture findings as a follow-up `plans/14.11-networked-playtest-findings.md`. Depends on `npm install` having run on the test host so SQLite + concurrently are available. | (no code; produces a plan-input file) |
| [14.12](14.12-active-seat-header.md) | Board header derives the active seat from `ctx.activePlayers` instead of `ctx.currentPlayer`. Surfaced by the post-14.1 / 14.2 smoke: round-2 `chiefPhase` mis-labelled "Player 4's turn". | `src/Board.tsx`, `src/ui/layout/activeSeat.ts` (new) |

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
