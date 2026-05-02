// Dev-only fly-out anchored to the right edge. Mirrors the placement of
// bgio's built-in Debug panel (which lives on the right and opens with
// the `.` key). Renders nothing in production builds — `import.meta.env.DEV`
// is inlined by Vite so the bundle dead-code-eliminates the whole file.
//
// Collapsed: a 28px tab labeled "Dev". Expanded: a small drawer with
// dev links (currently just "Card relationships"; future tools append
// here without touching Board.tsx).

import { useState } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useCardInfo } from '../cards/cardInfoContextValue.ts';

const isDev: boolean =
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

export interface DevSidebarProps {
  /** Optional bgio moves bag. When provided, dev shortcuts that need to
   *  dispatch moves (e.g. bank top-up) are enabled. */
  moves?: Record<string, (...args: unknown[]) => void>;
}

export function DevSidebar({ moves }: DevSidebarProps = {}) {
  const [open, setOpen] = useState(false);
  const cardInfo = useCardInfo();
  const onOpenRelationships = () => cardInfo?.openWithoutFocus();
  const onGiveChiefAll = () => {
    const fn = moves?.__devBankAddAll;
    if (typeof fn === 'function') fn(10);
  };
  if (!isDev) return null;

  if (!open) {
    return (
      <Tooltip title="Open dev tools" placement="left">
        <IconButton
          aria-label="Open dev tools"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            top: 80,
            right: 0,
            zIndex: 1200,
            borderTopLeftRadius: 6,
            borderBottomLeftRadius: 6,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            bgcolor: (t) => t.palette.card.surface,
            color: (t) => t.palette.status.muted,
            border: '1px dashed',
            borderColor: (t) => t.palette.status.muted,
            borderRight: 'none',
            px: 1,
            py: 0.5,
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Dev ›
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Box
      role="region"
      aria-label="Developer tools"
      sx={{
        position: 'fixed',
        top: 60,
        right: 0,
        zIndex: 1200,
        width: 240,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px dashed',
        borderColor: (t) => t.palette.status.muted,
        borderRight: 'none',
        borderTopLeftRadius: 6,
        borderBottomLeftRadius: 6,
        boxShadow: (t) => t.palette.shadow.floating,
        p: 1,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.status.muted,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Dev tools
        </Typography>
        <IconButton
          aria-label="Close dev tools"
          size="small"
          onClick={() => setOpen(false)}
          sx={{ fontSize: '0.8rem' }}
        >
          ×
        </IconButton>
      </Stack>
      <Stack spacing={1}>
        <Button
          variant="outlined"
          size="small"
          onClick={onOpenRelationships}
          fullWidth
          sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
        >
          Card relationships
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={onGiveChiefAll}
          disabled={typeof moves?.__devBankAddAll !== 'function'}
          fullWidth
          sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
        >
          Bank: +10 of each
        </Button>
      </Stack>
    </Box>
  );
}

export default DevSidebar;
