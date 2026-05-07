// Shared placeholder primitive for layout schematics.
//
// Layouts in this folder are about *spatial intent*, not live content,
// so every "where the X goes" rectangle is rendered through `<Slot>`.
// Pass a `label` (the name of the sub-component that would sit there)
// and optional `note` (what it does, in 1-3 words). The dashed border
// makes it obvious this is a layout sketch, not a real surface.

import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Role } from '../../game/types.ts';

export interface SlotProps {
  label: string;
  note?: string;
  /** Optional role accent — paints the dashed border + label tint. */
  role?: Role;
  /** Optional emphasis — paints a soft fill so a "hero" slot reads. */
  emphasis?: 'hero' | 'muted' | 'plain';
  /** Min height in px so the schematic preserves visual weight. */
  minHeight?: number;
  /** Optional content rendered inside the slot (sub-slots, etc.). */
  children?: ReactNode;
  /** Extra sx (mostly for grid placement). */
  sx?: SxProps<Theme>;
}

export function Slot({
  label,
  note,
  role,
  emphasis = 'plain',
  minHeight,
  children,
  sx,
}: SlotProps) {
  return (
    <Box
      sx={[
        {
          position: 'relative',
          borderRadius: 1.25,
          border: '1px dashed',
          borderColor: (t) =>
            role !== undefined
              ? t.palette.role[role].main
              : t.palette.status.muted,
          bgcolor: (t) =>
            emphasis === 'hero'
              ? alpha(
                  role !== undefined
                    ? t.palette.role[role].main
                    : t.palette.status.muted,
                  0.1,
                )
              : emphasis === 'muted'
                ? alpha(t.palette.status.muted, 0.05)
                : 'transparent',
          px: 1,
          py: 0.75,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          minWidth: 0,
          minHeight,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'baseline', minWidth: 0 }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: (t) =>
              role !== undefined
                ? t.palette.role[role].dark
                : t.palette.text.primary,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </Typography>
        {note !== undefined ? (
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              lineHeight: 1.1,
              fontStyle: 'italic',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {note}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

export default Slot;
