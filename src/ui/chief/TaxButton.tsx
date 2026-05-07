// TaxButton — chief super-power surface.
//
// Renders a single "Tax" button alongside the chief's other actions and
// previews the per-resource take in the tooltip. The button is disabled
// when:
//   - we're outside chiefPhase (`canAct` is false), OR
//   - the once-per-round latch is set (`G.chief.taxedThisRound`), OR
//   - no non-chief stash carries ≥ 2 of any resource (everything would
//     floor to zero — no point burning the round's slot for nothing).
//
// The dispatch is plain `chiefTax()`. The move re-validates legality so
// a stale `canAct` flag won't mint resources; the predicted take in the
// tooltip is computed off the same G snapshot the panel reads.

import { Box, Button, Tooltip, Typography } from '@mui/material';
import type { PlayerID, SettlementState } from '../../game/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES, RESOURCE_DISPLAY } from '../../game/resources/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';

export interface TaxButtonProps {
  G: SettlementState;
  /** True only during chiefPhase. */
  canAct: boolean;
  /** Dispatches `chiefTax`. */
  onTax: () => void;
}

/**
 * Walk every non-chief stash and return the per-resource sum of
 * `floor(stash[r] / 2)`. Pure — same shape the move uses to compute
 * the actual levy.
 */
const previewTake = (G: SettlementState): Partial<ResourceBag> => {
  const out: Partial<ResourceBag> = {};
  for (const [seat, mat] of Object.entries(G.mats ?? {})) {
    if (mat === undefined) continue;
    if (rolesAtSeat(G.roleAssignments, seat as PlayerID).includes('chief')) {
      continue;
    }
    for (const r of RESOURCES as ReadonlyArray<Resource>) {
      const have = mat.stash[r] ?? 0;
      if (have <= 1) continue;
      out[r] = (out[r] ?? 0) + Math.floor(have / 2);
    }
  }
  return out;
};

export function TaxButton({ G, canAct, onTax }: TaxButtonProps) {
  const latched = G.chief?.taxedThisRound === true;
  const take = previewTake(G);
  const takeEntries = (Object.entries(take) as Array<[Resource, number]>)
    .filter(([, v]) => v > 0);
  const hasTake = takeEntries.length > 0;

  const disabled = !canAct || latched || !hasTake;

  // Tooltip body: explain the rule + show the predicted take. We render
  // the take per-resource so the chief can see exactly what they're
  // about to do.
  const ruleText =
    'Tax: take half of every non-chief stash (rounded down). The bank gains half of what was taken (rounded up). The rest evaporates.';
  let tooltipBody: React.ReactNode;
  if (latched) {
    tooltipBody = 'Already taxed this round.';
  } else if (!canAct) {
    tooltipBody = 'Available only during your phase.';
  } else if (!hasTake) {
    tooltipBody = `${ruleText} Nothing to tax: no stash has ≥ 2 of any resource.`;
  } else {
    const bankPreview = takeEntries
      .map(([r, v]) => `${Math.ceil(v / 2)} ${RESOURCE_DISPLAY[r].name}`)
      .join(', ');
    const lostPreview = takeEntries
      .map(([, v]) => Math.floor(v / 2))
      .reduce((a, b) => a + b, 0);
    tooltipBody = (
      <Box sx={{ maxWidth: 280 }}>
        <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
          {ruleText}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Bank gains: {bankPreview}.
        </Typography>
        {lostPreview > 0 ? (
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
            Evaporates: {lostPreview} token{lostPreview === 1 ? '' : 's'}.
          </Typography>
        ) : null}
      </Box>
    );
  }

  return (
    <Tooltip title={tooltipBody}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <Button
          variant="outlined"
          disabled={disabled}
          onClick={onTax}
          data-chief-tax-button="true"
          data-chief-tax-disabled={disabled ? 'true' : 'false'}
          aria-label="Tax all non-chief seats."
          sx={{
            borderColor: (t) => t.palette.role.chief.main,
            color: (t) => t.palette.role.chief.main,
            fontWeight: 700,
            letterSpacing: '0.04em',
            '&:hover': {
              borderColor: (t) => t.palette.role.chief.dark,
              bgcolor: (t) => t.palette.role.chief.main + '10',
            },
          }}
        >
          Tax
        </Button>
      </Box>
    </Tooltip>
  );
}

export default TaxButton;
