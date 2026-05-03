// SectionHeading — small left-aligned label used inside the role
// panels to title each block ("Cards", "Send Resources", "Research
// Areas", "Village", "Army", "Excursions"). Uses the holder role's
// palette accent so the heading colors match the panel border.

import { Typography } from '@mui/material';
import type { Role } from '../../game/types.ts';

export interface SectionHeadingProps {
  role: Role;
  children: React.ReactNode;
}

export function SectionHeading({ role, children }: SectionHeadingProps) {
  return (
    <Typography
      variant="overline"
      sx={{
        color: (t) => t.palette.role[role].main,
        fontWeight: 700,
        letterSpacing: '0.08em',
        lineHeight: 1,
        textAlign: 'left',
      }}
    >
      {children}
    </Typography>
  );
}

export default SectionHeading;
