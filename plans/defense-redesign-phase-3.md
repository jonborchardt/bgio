# Phase 3 — UI: track strip, stack visualization, path overlay, HP, indicators

**Source spec:** [reports/defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** [phase-2](./defense-redesign-phase-2.md) must be
merged.

## What this phase does

Phase 3 is the **UI build**. It surfaces the Phase-2 mechanics on
the React board so a human player can read what's happening at a
glance. By the end of Phase 3, the game is shippable as the new
design.

The UI requirements come straight from the spec §10:

1. **Track strip** — past / current / next-card telegraph, with
   phase markers.
2. **Stack visualization** — placed units stacked vertically on a
   tile, oldest at the bottom (so first-placed = first-killed reads
   visually).
3. **Path overlay** — when a threat resolves, briefly highlight its
   path edge → impact tile.
4. **Building HP indicator** — 1–4 pips per building tile.
5. **Center-burn announcement** — floating banner when the center
   pool takes a hit.
6. **Boss thresholds readout** — when boss is in the next-card slot,
   show village's current Science / Economy / Military totals next
   to the boss's required numbers.
7. **Drill / teach indicators** — drilled unit gets a small
   one-shot icon; taught skills appear as a row of tags on the
   unit.

## What this phase does NOT do

- Playtest tuning, content polish, balance changes — those are
  separate passes.
- Networked-multiplayer-specific UX (lobby tweaks, etc.). The
  multiplayer transport is unchanged.

## Sub-phases (initial breakdown — to be expanded in their own files)

1. **3.1 — Track strip component.** Renders past (greyed), current
   (highlighted), next (telegraphed face-up), with phase markers
   above and a thin progress bar. Lives in
   `src/ui/track/TrackStrip.tsx`.
2. **3.2 — Domestic grid update.** Render center tile distinctly,
   render building tiles with HP pips and damage flash, render
   stacked units vertically on each tile (oldest visually
   bottom-most). Touch-up of `src/ui/domestic/`.
3. **3.3 — Path overlay + threat resolve animation.** When a flip
   resolves, paint a short-lived path overlay from edge to impact
   tile. Lives in `src/ui/track/PathOverlay.tsx` and a small
   resolution-event channel from the resolver to the UI.
4. **3.4 — Center-burn banner.** Floating notification when a
   center hit posts a `centerBurn` to `bankLog`. Reads the bank log
   tail for the latest entry and animates briefly. Lives in
   `src/ui/center/CenterBurnBanner.tsx`.
5. **3.5 — Boss panel.** When the next-card is the boss, show a
   side-by-side comparison of village totals vs boss thresholds
   (color-coded met / unmet). Lives in
   `src/ui/track/BossReadout.tsx`.
6. **3.6 — Defense panel rewrite.** Replace the foreign panel with
   a Defense panel: hand of unit cards, button to buy + place,
   tech-card row, indicator of telegraphed next card. Drill / teach
   indicators on placed units.
7. **3.7 — Science panel update.** Add Drill button + Teach button
   to the existing science panel. Both target a unit (modal pick a
   unit from the grid). Teach requires a skill choice.
8. **3.8 — Chief panel update.** Add a "Flip Track" button visible
   after chief's other actions are done; clicking flips the next
   card and triggers the resolve animation.
9. **3.9 — Polish + accessibility.** Tooltips on every new icon,
   keyboard navigation for the track strip, color-blind-safe
   palette for HP pips and threshold readouts.

Ordering: 3.1 first (everyone references the track). 3.2 in
parallel (visual core of the village). 3.3 + 3.4 layered on top.
3.5 last among visual elements (it depends on knowing the track is
correctly displayed). 3.6 + 3.7 + 3.8 are role-panel rewrites that
can land in any order once 3.1–3.5 are merged. 3.9 is cleanup.

## Exit criteria for Phase 3

- A human can play through a full match in the hot-seat client
  using only mouse interactions, no debug commands.
- E2E smoke test (`npm run e2e:smoke`) covers a 4-player game with
  1 human + 3 bots and reaches a boss outcome (win or time-up).
- All UI elements in spec §10 are present and visually consistent
  with the existing MUI theme.
- No raw hex literals in any new component file (lint rule from
  CLAUDE.md).

## Risks / open spots flagged for sub-phase planning

- **Animation performance on slow client.** Path overlay and damage
  flash both want short animations; keep them ≤ 250ms each, no
  blocking transitions. Test on mobile / low-end laptop.
- **Stack visualization with 5+ units on one tile.** Visual stacking
  beyond ~3 units becomes ambiguous. Decide whether to show a "+N"
  badge or a numbered marker for placement order.
- **Color-blind compliance.** HP pips and met / unmet thresholds
  must not rely on red / green alone. Use shape / fill state too.
- **Center mat reuse.** The current `CenterMat` component shows
  per-seat resource summaries. After Phase 1 these still exist; the
  center *tile* is a separate concept. Likely both stay, but the
  center mat layout may need adjustment to make room for the new
  banner.
- **Theme tokens.** Any new visual tokens (track-card colors, phase
  marker colors, drill indicator) must land in `src/theme.ts` per
  the CLAUDE.md "no raw hex literals in components" rule.
