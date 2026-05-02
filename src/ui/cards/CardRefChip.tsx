// Inline chip used to surface a referenced card (building / unit) inside
// another card's body — e.g. the buildings/units lines on a tech card's
// per-role sections. Clicking the small `?` opens the relationships
// modal focused on that card. When no provider is mounted (headless test,
// dev-mode-disabled build) the `?` silently disappears, leaving just the
// name as text.

import { Box, IconButton, Typography } from '@mui/material';
import { useCardInfo } from './cardInfoContextValue.ts';
import { findBuildingId, findUnitId } from '../../cards/registry.ts';

export type CardRefKind = 'building' | 'unit';

export interface CardRefChipProps {
  name: string;
  kind: CardRefKind;
  /** Inherits the surrounding text size so the chip lines up with the
   *  body text it appears inside. */
  fontSize?: string;
}

const lookupId = (
  kind: CardRefKind,
  name: string,
): string | undefined =>
  kind === 'building' ? findBuildingId(name) : findUnitId(name);

export function CardRefChip({ name, kind, fontSize = '0.7rem' }: CardRefChipProps) {
  const ctx = useCardInfo();
  const id = lookupId(kind, name);
  const dim = 14;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.2,
        whiteSpace: 'nowrap',
      }}
    >
      <Typography
        component="span"
        variant="caption"
        sx={{
          color: 'text.primary',
          lineHeight: 1.2,
          fontSize,
          fontWeight: 600,
        }}
      >
        {name}
      </Typography>
      {ctx && id ? (
        <IconButton
          aria-label={`Open ${name} card info`}
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            ctx.open(id);
          }}
          sx={{
            width: dim,
            height: dim,
            minWidth: dim,
            minHeight: dim,
            p: 0,
            ml: 0.05,
            fontSize: '0.55rem',
            fontWeight: 800,
            color: (t) => t.palette.status.muted,
            border: '1px solid',
            borderColor: (t) => t.palette.status.muted,
            borderRadius: '50%',
            opacity: 0.85,
            '&:hover': {
              opacity: 1,
              color: (t) => t.palette.status.active,
              borderColor: (t) => t.palette.status.active,
            },
          }}
        >
          ?
        </IconButton>
      ) : null}
    </Box>
  );
}

export default CardRefChip;
