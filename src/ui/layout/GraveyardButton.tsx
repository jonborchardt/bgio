// Per-seat graveyard viewer — a small button that opens a dialog
// listing every card the seat has played / placed / recruited, in
// chronological order (oldest first, freshest at the bottom).
//
// The graveyard itself is public state (`G.graveyards[seat]`); both
// players and spectators can inspect any seat's history. Cards are
// rendered via `AnyCard` so a tech, building, and unit each get their
// canonical look. Empty graveyards still render the dialog with a
// placeholder so clicking the button always gives feedback.

import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import type { GraveyardEntry, Role } from '../../game/types.ts';
import { AnyCard } from '../cards/AnyCard.tsx';
import { cardById } from '../../cards/registry.ts';

export interface GraveyardButtonProps {
  /** The role this graveyard belongs to. Drives the button accent. */
  role: Role;
  /** Ordered log; oldest first. Caller passes
   *  `G.graveyards?.[seat] ?? []`. */
  entries: ReadonlyArray<GraveyardEntry>;
  /** Optional label override. Defaults to "Played". */
  label?: string;
}

export function GraveyardButton({
  role,
  entries,
  label = 'Played',
}: GraveyardButtonProps) {
  const [open, setOpen] = useState(false);
  const count = entries.length;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={() => setOpen(true)}
        aria-label={`Open ${role} graveyard (${count} cards)`}
        sx={{
          color: (t) => t.palette.role[role].main,
          borderColor: (t) => t.palette.role[role].main,
          textTransform: 'none',
        }}
      >
        {label} ({count})
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="graveyard-dialog-title"
      >
        <DialogTitle
          id="graveyard-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: (t) => t.palette.role[role].main,
            fontWeight: 700,
          }}
        >
          {role[0]!.toUpperCase() + role.slice(1)} graveyard ({count})
          <IconButton
            aria-label="Close graveyard"
            size="small"
            onClick={() => setOpen(false)}
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {count === 0 ? (
            <Typography
              variant="body2"
              sx={{ color: (t) => t.palette.status.muted, fontStyle: 'italic' }}
            >
              Nothing played yet.
            </Typography>
          ) : (
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ flexWrap: 'wrap', rowGap: 1.25, alignItems: 'flex-start' }}
            >
              {entries.map((entry, i) => {
                const card = cardById(entry.cardId);
                return (
                  <Box
                    key={`${entry.cardId}-${i}`}
                    sx={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 0.25,
                    }}
                  >
                    {card ? (
                      <AnyCard entry={card} size="small" />
                    ) : (
                      <Typography variant="caption">{entry.name}</Typography>
                    )}
                    <Typography
                      variant="caption"
                      sx={{
                        color: (t) => t.palette.status.muted,
                        textAlign: 'center',
                        fontSize: '0.6rem',
                      }}
                    >
                      R{entry.round}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GraveyardButton;
