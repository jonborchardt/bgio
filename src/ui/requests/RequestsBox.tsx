// RequestsBox — one of the three boxes in <RequestsRow>. Shows the
// requests between the local seat and one specific peer seat: what the
// peer needs from me ("From them") and what I asked from the peer
// ("To them"). Both sections live in the same box, no scroll.

import { Box, Paper, Stack, Typography } from '@mui/material';
import type { HelpRequest } from '../../game/requests/types.ts';
import type { Role } from '../../game/types.ts';
import { formatNeed } from './formatNeed.tsx';

const ROLE_LABEL: Record<Role, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  foreign: 'Foreign',
};

export interface RequestsBoxProps {
  /** Display label for the peer seat ("Chief", "Science", "P3"). */
  peerLabel: string;
  /** Primary role at the peer seat — drives the box header accent. */
  peerRole?: Role;
  /** Requests where the peer is the requester and the local seat is
   *  the recipient. */
  fromThem: HelpRequest[];
  /** Requests where the local seat is the requester and the peer is
   *  the recipient. */
  toThem: HelpRequest[];
  /** Hide the outgoing ("You asked for") section entirely. Used for
   *  the chief panel — the chief is the giver, not an asker. */
  hideOutgoing?: boolean;
  /** Hide the incoming ("They asked for") section entirely. Used for
   *  the chief peer box on non-chief panels — chief never asks, so
   *  showing "They asked for" implies an action that can't happen. */
  hideIncoming?: boolean;
}

const Section = ({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: HelpRequest[];
  emptyText: string;
}) => (
  <Stack spacing={0.25}>
    <Typography
      variant="caption"
      sx={{
        color: (t) => t.palette.status.muted,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        fontSize: '0.6rem',
      }}
    >
      {title}
    </Typography>
    {rows.length === 0 ? (
      <Typography
        variant="caption"
        sx={{ color: (t) => t.palette.status.muted, fontStyle: 'italic' }}
      >
        {emptyText}
      </Typography>
    ) : (
      <Stack spacing={0.25}>
        {rows.map((r) => (
          <Box
            key={r.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              fontSize: '0.78rem',
            }}
          >
            <Box component="span" sx={{ fontWeight: 600 }}>
              {ROLE_LABEL[r.fromRole]}:
            </Box>
            {formatNeed(r.need)}
            <Box
              component="span"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              for {r.targetLabel}
            </Box>
          </Box>
        ))}
      </Stack>
    )}
  </Stack>
);

export function RequestsBox({
  peerLabel,
  peerRole,
  fromThem,
  toThem,
  hideOutgoing = false,
  hideIncoming = false,
}: RequestsBoxProps) {
  return (
    <Paper
      elevation={0}
      aria-label={`Requests with ${peerLabel}`}
      sx={{
        flex: 1,
        minWidth: 0,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) =>
          peerRole !== undefined
            ? t.palette.role[peerRole].main
            : t.palette.status.muted,
        borderRadius: 1,
        p: 1,
      }}
    >
      <Stack spacing={0.5}>
        <Typography
          variant="overline"
          sx={{
            color: (t) =>
              peerRole !== undefined
                ? t.palette.role[peerRole].main
                : t.palette.status.active,
            fontWeight: 700,
            letterSpacing: '0.08em',
            lineHeight: 1,
          }}
        >
          {peerLabel}
        </Typography>
        {hideIncoming ? null : (
          <Section
            title="They asked for"
            rows={fromThem}
            emptyText="(nothing)"
          />
        )}
        {hideOutgoing ? null : (
          <Section
            title="You asked for"
            rows={toThem}
            emptyText="(nothing)"
          />
        )}
      </Stack>
    </Paper>
  );
}

export default RequestsBox;
