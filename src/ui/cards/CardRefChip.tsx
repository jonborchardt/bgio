// Inline chip used to surface a referenced card (building / unit) inside
// another card's body — e.g. the buildings/units lines on a tech card's
// per-role sections. Hovering the small `?` previews the referenced card;
// clicking opens the relationships graph focused on it. When no provider
// is mounted (headless test, dev-mode-disabled build) the `?` silently
// disappears, leaving just the name as text.

import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useCardInfo } from './cardInfoContextValue.ts';
import { cardById, findBuildingId, findUnitId } from '../../cards/registry.ts';
import { AnyCard } from './AnyCard.tsx';

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
  const entry = id ? cardById(id) : undefined;
  const dim = 14;
  const button =
    ctx && id ? (
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
    ) : null;
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
      {button && entry ? (
        <Tooltip
          arrow
          placement="top"
          enterDelay={150}
          leaveDelay={50}
          slotProps={{
            tooltip: {
              sx: {
                bgcolor: 'transparent',
                p: 0,
                m: 0,
                maxWidth: 'none',
              },
            },
          }}
          title={<AnyCard entry={entry} size="normal" />}
        >
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </Box>
  );
}

export default CardRefChip;
