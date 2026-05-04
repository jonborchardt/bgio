# Sub-phase 3.7 — Science panel update (Drill + Teach)

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §8a, D27 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** Phase 2 fully merged. Soft predecessor: 3.6 (so
the in-play units list visualizes drill markers).

## Goal

Surface the new science moves — Drill and Teach — in the existing
science panel. Both target a unit on the grid; both have a once-
per-round cap displayed clearly.

## Files touched

- `src/ui/science/SciencePanel.tsx` (existing — additive edit).
- `src/ui/science/DrillButton.tsx` (new).
- `src/ui/science/TeachDialog.tsx` (new).
- `src/ui/science/UnitPicker.tsx` (new — reusable; Defense panel
  may want it too).
- `src/theme.ts` — science accent (`palette.role.science`) reuse.

## Drill flow

1. Player clicks **Drill** in SciencePanel.
2. UnitPicker opens (modal or inline), listing every unit on
   the grid with HP and tile location.
3. Player picks a unit.
4. Dispatches `scienceDrill(unitID)`.
5. Drill button greys out for the rest of the round.

If `scienceDrillUsed === true` already, the button is disabled
with a tooltip explaining "drilled this round."

## Teach flow

1. Player clicks **Teach** in SciencePanel.
2. TeachDialog opens with two pickers:
   - Skill picker: every entry in `SKILLS` with cost + description.
   - Unit picker: same list as Drill's.
3. Player confirms.
4. Dispatches `scienceTeach(unitID, skillID)`.
5. Teach button greys out for the rest of the round.

The dialog should clearly show:

- Cost of the chosen skill in science from stash.
- Whether the seat can afford it.
- Whether the chosen unit already has the skill (refuse with a
  message; the move would be INVALID_MOVE anyway).

## Indicators

- Drill indicator appears on the unit (handled by 3.2 + 3.6).
- Taught skills appear as tags on the unit (handled by 3.6).
- SciencePanel shows two small status lines:
  - "Drill: available" / "Drill: used this round"
  - "Teach: available" / "Teach: used this round"

## Tests

- DrillButton dispatches the right move with the right unit ID.
- Disabled state when used.
- TeachDialog refuses confirm when seat can't afford.
- TeachDialog refuses skill the unit already has.
- Round transition re-enables both buttons.

## Out of scope

- Visual indicators on the unit (3.2 / 3.6 own those).
- Skill content tuning.
- A "history of drills/teaches" pane (not a Phase 3 deliverable).

## Done when

- Science seat can drill / teach via mouse in hot-seat.
- Both moves' once-per-round cap is enforced visually.
- All visuals from `palette.role.science` and theme tokens.
- Tests pass.
