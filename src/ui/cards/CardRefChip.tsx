// Inline chip used to surface a referenced card (building / unit) inside
// another card's body — e.g. the buildings/units lines on a tech card's
// per-role sections. Hovering the small `?` previews the referenced card;
// clicking opens the relationships graph focused on it. When no provider
// is mounted (headless test, dev-mode-disabled build) the `?` silently
// disappears, leaving just the name as text.
//
// `previewOnly` suppresses the click-to-graph behavior so the chip is
// pure hover-preview — used by the requests row, where the relationships
// graph is the wrong destination.

import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useCardInfo } from './cardInfoContextValue.ts';
import {
  cardById,
  findBuildingId,
  findTechId,
  findUnitId,
} from '../../cards/registry.ts';
import { AnyCard } from './AnyCard.tsx';

export type CardRefKind = 'building' | 'unit' | 'tech' | 'science';

export interface CardRefChipProps {
  name: string;
  kind: CardRefKind;
  /** Inherits the surrounding text size so the chip lines up with the
   *  body text it appears inside. */
  fontSize?: string;
  /** When true, the `?` button is hover-only — clicking it does not
   *  open the relationships modal. Used in the requests row, where
   *  the player just wants to see what was asked for, not navigate. */
  previewOnly?: boolean;
  /** When provided, used in place of `findXId(name)` — useful for
   *  kinds whose target id is not derivable from the display name
   *  (e.g. science cards, where the canonical id is the (color, tier,
   *  level) triple, not the label "red L0"). */
  cardId?: string;
}

const lookupId = (
  kind: CardRefKind,
  name: string,
): string | undefined => {
  switch (kind) {
    case 'building':
      return findBuildingId(name);
    case 'unit':
      return findUnitId(name);
    case 'tech':
      return findTechId(name);
    case 'science':
      // Science cards are addressed by canonical id, not name —
      // callers must pass `cardId` for this kind.
      return undefined;
  }
};

export function CardRefChip({
  name,
  kind,
  fontSize = '0.7rem',
  previewOnly = false,
  cardId,
}: CardRefChipProps) {
  const ctx = useCardInfo();
  const id = cardId ?? lookupId(kind, name);
  const entry = id ? cardById(id) : undefined;
  const dim = 14;
  const showButton = entry !== undefined && (previewOnly || ctx !== null);
  const button = showButton ? (
      <IconButton
        aria-label={
          previewOnly ? `Preview ${name}` : `Open ${name} card info`
        }
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          if (!previewOnly && ctx && id) ctx.open(id);
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
