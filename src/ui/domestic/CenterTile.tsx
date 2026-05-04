// Defense redesign 3.2 — CenterTile.
//
// Renders the village vault at `(0, 0)`. Visually distinct from the
// regular building tiles:
//
//   - circular footprint inside the same grid cell
//   - "Vault" label
//   - inset showing the live total of the **pooled non-chief stash**
//     (sum of every non-chief seat's stash across all resources). This
//     is the number threats burn from when they reach center, so the
//     table reads it at a glance.
//
// Center-burn animations land in 3.4; this component is the static
// surface they'll layer on top of.
//
// The tile has no HP track (D2: the center is never destroyed) so we
// do not render `HpPips`. Buildings stacked on this tile are likewise
// out of scope — D11 places units on **building** tiles, not on the
// center vault.

import { Box, Stack, Tooltip, Typography } from '@mui/material';

export interface CenterTileProps {
  /** Pre-summed pooled stash total. Computed by the caller from
   *  `G.mats[seat].stash` for every non-chief seat. */
  pooledTotal: number;
  /** Optional per-resource breakdown for the tooltip body — keeps the
   *  glanceable single number on the tile face while still letting a
   *  curious player drill in. */
  pooledBreakdown?: Array<{ resource: string; amount: number }>;
}

export function CenterTile({
  pooledTotal,
  pooledBreakdown,
}: CenterTileProps) {
  const tooltip =
    pooledBreakdown && pooledBreakdown.length > 0 ? (
      <Stack spacing={0.25}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Village vault — pooled stash
        </Typography>
        {pooledBreakdown
          .filter((b) => b.amount > 0)
          .map((b) => (
            <Typography key={b.resource} variant="caption">
              {b.resource}: {b.amount}
            </Typography>
          ))}
        {pooledBreakdown.every((b) => b.amount <= 0) ? (
          <Typography variant="caption">(empty)</Typography>
        ) : null}
      </Stack>
    ) : (
      'Village vault — pooled non-chief stash'
    );

  return (
    <Tooltip title={tooltip} placement="top">
      <Box
        data-center-tile="true"
        aria-label={`Village vault — pooled stash ${pooledTotal}`}
        sx={{
          position: 'relative',
          width: '100%',
          minHeight: '240px',
          // The tile renders as a circle inside the grid cell. We use
          // a rounded square outer wrapper for the click target / aria
          // box and an inner circular surface for the visible vault
          // disc.
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: '78%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            bgcolor: (t) => t.palette.centerTile.surface,
            color: (t) => t.palette.centerTile.text,
            border: '3px solid',
            borderColor: (t) => t.palette.centerTile.accent,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            boxShadow: (t) => t.palette.shadow.card,
            // 3.4 will stamp center-burn flashes on top of this; keep
            // the surface stable so the animation has somewhere to
            // attach.
            transition: 'box-shadow 200ms',
          }}
        >
          <Typography
            variant="overline"
            sx={{
              letterSpacing: '0.1em',
              lineHeight: 1,
              fontWeight: 700,
              opacity: 0.85,
            }}
          >
            Vault
          </Typography>
          <Typography
            variant="h4"
            data-center-pooled={pooledTotal}
            sx={{
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {pooledTotal}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              opacity: 0.75,
              lineHeight: 1,
            }}
          >
            pooled stash
          </Typography>
        </Box>
      </Box>
    </Tooltip>
  );
}

export default CenterTile;
