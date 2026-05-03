// Pretty-print a HelpRequest's `need` slice.
//
// Resources render as a row of ResourceTokens; named-thing variants
// (building / tech / unit) render as italic text with a kind prefix so
// the recipient can tell what kind of card is being asked for.

import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import type { RequestNeed } from '../../game/requests/types.ts';
import type { Resource } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';

export function formatNeed(need: RequestNeed): ReactNode {
  if (need.kind === 'resources') {
    const entries = (RESOURCES as ReadonlyArray<Resource>).filter(
      (r) => (need.bag[r] ?? 0) > 0,
    );
    if (entries.length === 0) return <Box component="span">—</Box>;
    return (
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          flexWrap: 'wrap',
        }}
      >
        {entries.map((r) => (
          <ResourceToken
            key={r}
            resource={r}
            count={need.bag[r] ?? 0}
            size="small"
          />
        ))}
      </Box>
    );
  }
  const prefix =
    need.kind === 'building'
      ? 'Building'
      : need.kind === 'tech'
        ? 'Tech'
        : 'Unit';
  return (
    <Box component="span" sx={{ fontStyle: 'italic' }}>
      {prefix}: {need.name}
    </Box>
  );
}
