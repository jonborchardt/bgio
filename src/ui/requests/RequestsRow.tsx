// RequestsRow — two side-by-side sections inside each role panel:
//
//   - "My asks": every request the local seat sent (one row per
//                recipient, color-chipped by recipient role).
//   - "Asks of me": every request the local seat received (one row
//                per requester, color-chipped by requester role).
//
// Each row carries the need bag/text plus a `?` button when the
// request's targetId references a card kind — hovering previews the
// canonical card via the shared `CardRefChip` (preview-only; we don't
// jump to the relationships graph from here).
//
// Per-direction suppression: chief is the giver and never asks, so
//   - on the chief panel, the "My asks" section is hidden, and
//   - on every panel, no row ever has chief as the asker (chief
//     can't ask), which the data naturally satisfies.

import { Box, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { PlayerID, Role, SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import type { HelpRequest } from '../../game/requests/types.ts';
import { SectionHeading } from '../layout/SectionHeading.tsx';
import { CardRefChip, type CardRefKind } from '../cards/CardRefChip.tsx';
import { formatNeed } from './formatNeed.tsx';

const ROLE_LABEL: Record<Role, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  defense: 'Defense',
};

// Card-backed targetIds use the canonical `<kind>:<name>` form from
// `src/cards/registry.ts`. Anything else (e.g. `trade:current`) is not
// previewable, so we render the bare label.
const CARD_REF_KIND_BY_PREFIX: Record<string, CardRefKind> = {
  building: 'building',
  unit: 'unit',
  tech: 'tech',
  science: 'science',
};

const cardKindOfTarget = (targetId: string): CardRefKind | null => {
  const colon = targetId.indexOf(':');
  if (colon <= 0) return null;
  return CARD_REF_KIND_BY_PREFIX[targetId.slice(0, colon)] ?? null;
};

const RoleChip = ({ role, label }: { role: Role; label: string }) => (
  <Box
    component="span"
    aria-label={`${ROLE_LABEL[role]} chip`}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      px: 0.6,
      py: 0.1,
      borderRadius: 0.75,
      bgcolor: (t) => t.palette.role[role].main,
      color: (t) => t.palette.role[role].contrastText,
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </Box>
);

const RequestRow = ({
  partyRole,
  partyLabel,
  request,
}: {
  partyRole: Role;
  partyLabel: string;
  request: HelpRequest;
}) => {
  const cardKind = cardKindOfTarget(request.targetId);
  const target: ReactNode = cardKind ? (
    <CardRefChip
      name={request.targetLabel}
      kind={cardKind}
      cardId={request.targetId}
      previewOnly
      fontSize="0.78rem"
    />
  ) : (
    <Box component="span" sx={{ fontWeight: 600 }}>
      {request.targetLabel}
    </Box>
  );
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        flexWrap: 'wrap',
        fontSize: '0.78rem',
      }}
    >
      <RoleChip role={partyRole} label={partyLabel} />
      {formatNeed(request.need)}
      <Box component="span" sx={{ color: (t) => t.palette.status.muted }}>
        for
      </Box>
      {target}
    </Box>
  );
};

const Section = ({
  title,
  panelRole,
  rows,
  emptyText,
  partyOf,
}: {
  title: string;
  panelRole: Role;
  rows: HelpRequest[];
  emptyText: string;
  /** Returns the role + display label of the *other party* in a row —
   *  the recipient for "my asks", the requester for "asks of me". */
  partyOf: (r: HelpRequest) => { role: Role; label: string };
}) => (
  <Paper
    elevation={0}
    sx={{
      flex: 1,
      minWidth: 0,
      bgcolor: (t) => t.palette.card.surface,
      border: '1px solid',
      borderColor: (t) => t.palette.role[panelRole].main,
      borderRadius: 1,
      p: 1,
    }}
  >
    <Stack spacing={0.5}>
      <Typography
        variant="overline"
        sx={{
          color: (t) => t.palette.role[panelRole].main,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: 1,
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
        <Stack spacing={0.4}>
          {rows.map((r) => {
            const party = partyOf(r);
            return (
              <RequestRow
                key={r.id}
                partyRole={party.role}
                partyLabel={party.label}
                request={r}
              />
            );
          })}
        </Stack>
      )}
    </Stack>
  </Paper>
);

export interface RequestsRowProps {
  G: SettlementState;
  playerID: PlayerID | null | undefined;
  /** The role that owns the surrounding panel — drives the heading
   *  accent color and gates whether "My asks" renders (chief never
   *  asks, so we hide it on the chief panel). */
  panelRole: Role;
}

export function RequestsRow({ G, playerID, panelRole }: RequestsRowProps) {
  if (playerID === undefined || playerID === null) return null;

  const requests = G.requests ?? [];
  const seats = Object.keys(G.roleAssignments);
  if (seats.filter((s) => s !== playerID).length === 0) return null;

  const labelForSeat = (seat: PlayerID): { role: Role; label: string } => {
    const roles = rolesAtSeat(G.roleAssignments, seat);
    // First role at the seat drives the chip color; the label lists
    // every role at the seat so multi-role layouts (1/2/3-player)
    // still read as "Chief/Science (P1)" rather than just "Chief".
    const primary = roles[0] ?? 'chief';
    const seatLabel = `P${Number(seat) + 1}`;
    const roleText =
      roles.length > 0
        ? roles.map((r) => ROLE_LABEL[r]).join('/')
        : seatLabel;
    return { role: primary, label: `${roleText} (${seatLabel})` };
  };

  const myAsks = requests.filter((r) => r.fromSeat === playerID);
  const asksOfMe = requests.filter((r) => r.toSeat === playerID);
  const showMyAsks = panelRole !== 'chief';

  return (
    <Stack spacing={0.75} aria-label="Help requests">
      <SectionHeading role={panelRole}>Requests</SectionHeading>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'stretch', flexWrap: 'wrap', rowGap: 1 }}
      >
        {showMyAsks ? (
          <Section
            title="My asks"
            panelRole={panelRole}
            rows={myAsks}
            emptyText="(no outstanding asks)"
            partyOf={(r) => labelForSeat(r.toSeat)}
          />
        ) : null}
        <Section
          title="Asks of me"
          panelRole={panelRole}
          rows={asksOfMe}
          emptyText="(no one is asking)"
          partyOf={(r) => ({ role: r.fromRole, label: ROLE_LABEL[r.fromRole] })}
        />
      </Stack>
    </Stack>
  );
}

export default RequestsRow;
