// EmbossedFrame — small role-tinted container with a repeating SVG
// dot pattern (a dark disc + offset light highlight stacked, which
// reads as raised bumps) plus the canonical inset emboss shadow.
// Used for the Village (domestic) and Army (defense) areas, and for
// the empty-state rows shown when a hand has no cards yet.

import { Box } from '@mui/material';
import type { BoxProps } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Role } from '../../game/types.ts';

const EMBOSS_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><circle cx='14' cy='14.7' r='1.7' fill='black' fill-opacity='0.35'/><circle cx='14' cy='13.3' r='1.7' fill='white' fill-opacity='0.08'/></svg>\")";

export interface EmbossedFrameProps extends BoxProps {
  role: Role;
}

export function EmbossedFrame({
  role,
  sx,
  children,
  ...rest
}: EmbossedFrameProps) {
  return (
    <Box
      {...rest}
      sx={[
        {
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: (t) => alpha(t.palette.role[role].dark, 0.18),
          backgroundImage: EMBOSS_SVG,
          boxShadow: (t) => t.palette.shadow.embossInset,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}

export default EmbossedFrame;
