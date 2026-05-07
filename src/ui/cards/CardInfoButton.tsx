// The "?" overlay every card carries. Clicking it asks the
// CardInfoProvider to open the relationships modal focused on this id.
// When no provider is mounted (headless test, dev-mode-disabled build)
// the button renders nothing — it's a feature, not chrome cards depend
// on. Hidden at `size === 'micro'` because micro cards are themselves
// click targets.

import { IconButton, Tooltip } from '@mui/material';
import { useCardInfo } from './cardInfoContextValue.ts';
import type { CardSize } from './sizes.ts';

export interface CardInfoButtonProps {
  cardId: string;
  size?: CardSize;
  /** Optional sub-id to highlight inside the focused card. Used by the
   *  in-game science variant card so the canonical view in the modal
   *  can mark "this is the variant placed in your match". */
  highlightSubId?: string;
}

const SIZE_BY_CARD_SIZE: Record<CardSize, { px: number; font: string }> = {
  micro: { px: 14, font: '0.6rem' },
  small: { px: 16, font: '0.65rem' },
  normal: { px: 18, font: '0.7rem' },
  detailed: { px: 20, font: '0.75rem' },
};

export function CardInfoButton({
  cardId,
  size = 'normal',
  highlightSubId,
}: CardInfoButtonProps) {
  const ctx = useCardInfo();
  if (!ctx) return null;
  if (size === 'micro') return null;
  const sizing = SIZE_BY_CARD_SIZE[size];
  return (
    <Tooltip title="Card info & relationships" placement="top" arrow>
      <IconButton
        aria-label="Open card info"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          ctx.open(cardId, highlightSubId);
        }}
        sx={{
          position: 'absolute',
          top: 2,
          right: 2,
          // Without an explicit z-index the absolute IconButton paints
          // beneath the in-flow Stack that holds the card body
          // (default `auto` z-index → DOM order wins). Bump it so
          // every card kind gets a clickable `?` over its content.
          zIndex: 2,
          width: sizing.px,
          height: sizing.px,
          minWidth: sizing.px,
          minHeight: sizing.px,
          fontSize: sizing.font,
          fontWeight: 700,
          color: (t) => t.palette.status.muted,
          bgcolor: (t) => t.palette.card.surface,
          border: '1px solid',
          borderColor: (t) => t.palette.status.muted,
          opacity: 0.8,
          '&:hover': {
            opacity: 1,
            color: (t) => t.palette.status.active,
            borderColor: (t) => t.palette.status.active,
          },
        }}
      >
        ?
      </IconButton>
    </Tooltip>
  );
}

export default CardInfoButton;
