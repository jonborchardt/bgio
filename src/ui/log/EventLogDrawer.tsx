// EventLogDrawer — bottom-right FAB that opens a right-anchored Drawer
// listing every recent move in the match, projected from bgio's
// `client.log` through `formatters.ts`. There is no parallel match-state
// log: every entry is derived render-time from the bgio-authoritative
// log + the current G.
//
// Order: strict chronological — newest entry at the bottom (the natural
// "things just happened" reading order). Round changes are marked with
// a horizontal divider, computed from phase transitions in the log.

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Divider,
  Drawer,
  Fab,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import type { LogEntry } from 'boardgame.io';
import {
  isCardPart,
  isResourcePart,
  type ActivityEntry,
  type ActivityPart,
} from './types.ts';
import type { PlayerID, Role, SettlementState } from '../../game/types.ts';
import { projectLog } from './projectLog.ts';
import { cardById, cardName } from '../../cards/registry.ts';
import { AnyCard } from '../cards/AnyCard.tsx';
import { ResourceToken } from '../resources/ResourceToken.tsx';

export interface EventLogDrawerProps {
  /** bgio's authoritative move log — passed through from BoardProps. */
  log: ReadonlyArray<LogEntry>;
  /** Current match state, used by formatters for static lookups
   *  (building grid cell defID, etc.). */
  G: SettlementState;
}

const seatLabel = (seat: PlayerID | undefined): string =>
  seat === undefined ? 'Engine' : `P${Number(seat) + 1}`;

const roleLabel = (role: Role | undefined): string =>
  role === undefined
    ? ''
    : role[0]!.toUpperCase() + role.slice(1);

export function EventLogDrawer({ log, G }: EventLogDrawerProps) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const entries = useMemo(() => projectLog(log, G), [log, G]);

  // Auto-scroll to the bottom whenever new entries arrive while the
  // drawer is open — the freshest action stays visible.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [open, entries.length]);

  return (
    <>
      <Fab
        color="primary"
        size="medium"
        aria-label={
          open ? 'Close event log' : `Open event log (${entries.length})`
        }
        onClick={() => setOpen((v) => !v)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: (t) => t.zIndex.drawer + 2,
          fontWeight: 700,
          fontSize: '0.9rem',
          textTransform: 'none',
        }}
      >
        {open ? '×' : 'Log'}
      </Fab>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: '24rem' },
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Event log ({entries.length})
          </Typography>
          <IconButton
            aria-label="Close event log"
            size="small"
            onClick={() => setOpen(false)}
          >
            ×
          </IconButton>
        </Box>

        <Box
          ref={scrollRef}
          sx={{ overflowY: 'auto', flex: 1, px: 2, py: 1 }}
        >
          {entries.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                color: (t) => t.palette.status.muted,
                fontStyle: 'italic',
                py: 1,
              }}
            >
              No events yet.
            </Typography>
          ) : (
            entries.map((e, i) => {
              const prevRound = i === 0 ? null : entries[i - 1]!.round;
              const showBreak = prevRound === null || prevRound !== e.round;
              return (
                <Box key={i}>
                  {showBreak ? <RoundBreak round={e.round} first={i === 0} /> : null}
                  <LogRow entry={e} />
                </Box>
              );
            })
          )}
        </Box>
      </Drawer>
    </>
  );
}

function RoundBreak({ round, first }: { round: number; first: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        my: first ? 0 : 1,
        mt: first ? 0 : 1.5,
      }}
    >
      <Divider sx={{ flex: 1 }} />
      <Typography
        variant="overline"
        sx={{
          color: (t) => t.palette.status.muted,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: 1,
        }}
      >
        Round {round}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Box>
  );
}

function LogRow({ entry }: { entry: ActivityEntry }) {
  const accent = (t: import('@mui/material').Theme) =>
    entry.role !== undefined
      ? t.palette.role[entry.role].main
      : t.palette.status.muted;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 1,
        alignItems: 'baseline',
        py: 0.25,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: accent,
          fontWeight: 700,
          minWidth: '4.5rem',
          whiteSpace: 'nowrap',
        }}
      >
        {seatLabel(entry.seat)}
        {entry.role !== undefined ? ` · ${roleLabel(entry.role)}` : ''}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.4,
          rowGap: 0.4,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}
      >
        {entry.parts.map((part, i) => (
          <PartView key={i} part={part} />
        ))}
      </Box>
    </Box>
  );
}

function PartView({ part }: { part: ActivityPart }) {
  if (typeof part === 'string') {
    return (
      <Box component="span" sx={{ whiteSpace: 'pre-wrap' }}>
        {part}
      </Box>
    );
  }
  if (isCardPart(part)) {
    return <LogCardRef cardId={part.card} label={part.label} />;
  }
  if (isResourcePart(part)) {
    return (
      <ResourceToken
        resource={part.resource}
        count={part.count}
        sign={part.sign}
        size="small"
      />
    );
  }
  return null;
}

function LogCardRef({ cardId, label }: { cardId: string; label?: string }) {
  const entry = cardById(cardId);
  const text = label ?? (entry ? cardName(entry) : cardId);
  return (
    <Tooltip
      arrow
      placement="left"
      title={
        entry !== undefined ? (
          <Box sx={{ p: 0.5 }}>
            <AnyCard entry={entry} size="small" />
          </Box>
        ) : (
          'Unknown card'
        )
      }
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'transparent',
            p: 0,
            maxWidth: 'none',
          },
        },
      }}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 0.25,
          fontStyle: 'italic',
          cursor: 'help',
          textDecoration: 'underline dotted',
          textUnderlineOffset: '2px',
        }}
      >
        {text}
        <Box
          component="sup"
          sx={{
            fontSize: '0.65em',
            fontWeight: 700,
            opacity: 0.6,
          }}
        >
          ?
        </Box>
      </Box>
    </Tooltip>
  );
}

export default EventLogDrawer;
