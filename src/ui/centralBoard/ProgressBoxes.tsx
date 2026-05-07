// ProgressBoxes — a labelled stack/row of 12 boxes that reads as
// "we are X% of the way to the boss threshold." Pure visual: no game
// logic lives here, the parent passes `current` and `target` and the
// component fills `round(current / target * 12)` boxes.
//
// Used in the central-board side gutters (vertical) for the Science
// and Economy progress widgets. The boss card never appears on the
// table — these widgets are the only signal the village has of how
// close it is to neutralizing a boss attack.

import { Box, Tooltip, Typography } from '@mui/material';

export interface ProgressBoxesProps {
  /** Short label rendered above the row. */
  label: string;
  /** Live value (completed science cards, max-vault-ever, …). */
  current: number;
  /** Threshold the row fills against. When ≤ 0 the row renders empty. */
  target: number;
  /** Layout orientation. Vertical stacks the boxes bottom-to-top so the
   *  fill reads as a "rising bar" in the side gutters. Horizontal lays
   *  them left-to-right (the original header layout). Defaults to
   *  vertical to match the central-board gutters. */
  orientation?: 'horizontal' | 'vertical';
  /** Accent palette key used for the filled boxes. */
  accent?: 'science' | 'gold' | 'active';
  /** Optional tooltip body that overrides the default
   *  "current / target" line. */
  tooltipTitle?: string;
}

/** Fixed box count — both science and economy widgets always show 12
 *  steps regardless of the threshold magnitude, so the table can
 *  compare the two side-by-side at a glance. The threshold (where the
 *  boss starts taking damage) sits at `THRESHOLD_BOX` boxes filled,
 *  leaving room above for "overshoot" — the chief who stockpiles past
 *  the threshold sees their progress continue to climb. */
const BOX_COUNT = 12;
const THRESHOLD_BOX = 6;

export function ProgressBoxes({
  label,
  current,
  target,
  orientation = 'vertical',
  accent = 'active',
  tooltipTitle,
}: ProgressBoxesProps) {
  const safeTarget = target > 0 ? target : 0;
  // Each box represents `unitsPerBox` units of progress so that exactly
  // `THRESHOLD_BOX` boxes fill at `current === target`. The cap of 1
  // protects against `target < THRESHOLD_BOX` (e.g. target = 1) so a
  // single-unit progression still moves the bar visibly.
  const unitsPerBox =
    safeTarget > 0 ? Math.max(1, Math.ceil(safeTarget / THRESHOLD_BOX)) : 0;
  const filledRaw = unitsPerBox > 0 ? Math.floor(current / unitsPerBox) : 0;
  const filled = Math.max(0, Math.min(BOX_COUNT, filledRaw));

  const tooltip =
    tooltipTitle ?? `${label}: ${current} of ${safeTarget}`;
  const isVertical = orientation === 'vertical';

  return (
    <Tooltip title={tooltip} placement={isVertical ? 'right' : 'top'}>
      <Box
        role="status"
        aria-label={`${label}: ${current} of ${safeTarget}`}
        data-testid={`progress-boxes-${label.toLowerCase().replace(/\s+/g, '-')}`}
        data-progress-filled={filled}
        data-progress-total={BOX_COUNT}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1.1,
          gap: 0.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.6rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: (t) => t.palette.status.muted,
          }}
        >
          {label}
        </Typography>
        <Box
          aria-hidden
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: isVertical ? 'column-reverse' : 'row',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {Array.from({ length: BOX_COUNT }, (_, i) => {
            const isFilled = i < filled;
            return (
              <Box
                key={i}
                data-progress-box-filled={isFilled ? 'true' : 'false'}
                sx={(t) => ({
                  width: 14,
                  height: 14,
                  borderRadius: 0.25,
                  border: '1px solid',
                  borderColor: isFilled
                    ? accent === 'gold'
                      ? t.palette.resource.gold.main
                      : accent === 'science'
                        ? t.palette.role.science.main
                        : t.palette.status.active
                    : t.palette.status.muted,
                  bgcolor: isFilled
                    ? accent === 'gold'
                      ? t.palette.resource.gold.main
                      : accent === 'science'
                        ? t.palette.role.science.main
                        : t.palette.status.active
                    : 'transparent',
                })}
              />
            );
          })}
          {/* Threshold marker — drawn between box (THRESHOLD_BOX - 1)
              and THRESHOLD_BOX so it visually marks "boss starts taking
              damage at this fill level." Filled boxes BELOW the line =
              progress not yet at threshold; filled boxes AT or ABOVE
              the line = boss damaged.
              Each box is 14px + 2px gap = 16px tall (vertical) /
              14px + 2px gap = 16px wide (horizontal); the marker
              centres on the gap between boxes. */}
          {safeTarget > 0 ? (
            <Box
              data-testid={`progress-threshold-${label.toLowerCase().replace(/\s+/g, '-')}`}
              sx={(t) => {
                const offsetPx = THRESHOLD_BOX * 16 - 1;
                if (isVertical) {
                  // column-reverse stacks bottom-to-top; "bottom" = box 0,
                  // so the marker offset is measured from the bottom edge.
                  return {
                    position: 'absolute',
                    bottom: `${offsetPx}px`,
                    left: -3,
                    right: -3,
                    height: '2px',
                    bgcolor: t.palette.status.active,
                    borderRadius: 1,
                  };
                }
                return {
                  position: 'absolute',
                  left: `${offsetPx}px`,
                  top: -3,
                  bottom: -3,
                  width: '2px',
                  bgcolor: t.palette.status.active,
                  borderRadius: 1,
                };
              }}
            />
          ) : null}
        </Box>
      </Box>
    </Tooltip>
  );
}

export default ProgressBoxes;
