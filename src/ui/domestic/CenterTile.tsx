// Defense redesign 3.2 — CenterTile.
//
// Renders the village vault at `(0, 0)` as a building-shaped tile so it
// reads as part of the village rather than a separate widget. Same
// rounded-rectangle footprint, same min-height, and same shadow as
// `<BuildingTile>` — but with a vault icon, distinct purple accent
// (palette.centerTile), and a live readout of the **pooled non-chief
// stash** (sum of every non-chief seat's stash across all resources).
// That number is what threats burn from when they reach center, so the
// table reads it at a glance.
//
// Center-burn animations land in 3.4; this component is the static
// surface they layer on top of.
//
// The tile has no HP track (D2: the center is never destroyed) so we
// do not render `HpPips`. Buildings stacked on this tile are likewise
// out of scope — D11 places units on **building** tiles, not on the
// center vault.

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

export interface CenterTileProps {
  /** Pre-summed pooled stash total. Computed by the caller from
   *  `G.mats[seat].stash` for every non-chief seat. */
  pooledTotal: number;
  /** Optional per-resource breakdown for the tooltip body — keeps the
   *  glanceable single number on the tile face while still letting a
   *  curious player drill in. */
  pooledBreakdown?: Array<{ resource: string; amount: number }>;
}

// Vault icon — a small inline SVG rendered with `currentColor` so it
// inherits the centerTile.text palette. Lock-on-chest silhouette reads
// as "stored treasure" without leaning on any external icon font.
function VaultIcon() {
  return (
    <Box
      component="svg"
      aria-hidden
      viewBox="0 0 32 32"
      sx={{
        width: 18,
        height: 18,
        color: 'currentColor',
        opacity: 0.9,
      }}
    >
      {/* Chest body */}
      <path
        d="M5 11 L27 11 L27 25 L5 25 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Chest lid */}
      <path
        d="M5 11 Q5 7 9 7 L23 7 Q27 7 27 11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lock plate */}
      <rect
        x="13"
        y="13"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      {/* Keyhole */}
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
    </Box>
  );
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
          // Match BuildingTile's `small` footprint so the vault sits
          // flush in the village tile grid. The accent + icon mark it
          // as the centre, not a different shape.
          position: 'relative',
          width: '100%',
          minHeight: '90px',
          borderRadius: 1.5,
          border: '2px solid',
          borderColor: (t) => t.palette.centerTile.accent,
          bgcolor: (t) => t.palette.centerTile.surface,
          color: (t) => t.palette.centerTile.text,
          boxShadow: (t) => t.palette.shadow.card,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.25,
          p: 0.5,
          // Subtle inner gradient so the vault reads as a heavier tile
          // than its neighbours without being a different shape.
          backgroundImage: (t) =>
            `linear-gradient(180deg, ${t.palette.centerTile.surface} 0%, ${alpha(t.palette.centerTile.accent, 0.2)} 100%)`,
          // 3.4 will stamp center-burn flashes on top of this; keep
          // the surface stable so the animation has somewhere to
          // attach.
          transition: 'box-shadow 200ms',
        }}
      >
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center', lineHeight: 1 }}
        >
          <VaultIcon />
          <Typography
            variant="caption"
            sx={{
              letterSpacing: '0.1em',
              lineHeight: 1,
              fontWeight: 800,
              opacity: 0.9,
              fontSize: '0.6rem',
            }}
          >
            VAULT
          </Typography>
        </Stack>
        <Typography
          variant="h6"
          data-center-pooled={pooledTotal}
          sx={{
            fontWeight: 800,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pooledTotal}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            opacity: 0.7,
            lineHeight: 1,
            fontSize: '0.55rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          pooled
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default CenterTile;
