// RequestsRow — one box per *other* seat, mounted inside each role
// panel just under the End-turn button. Each box shows the in-flight
// requests between the local viewer and that peer.
//
// Renders nothing for spectators (no seat → no asks) and nothing when
// the room has no other seats (1-player solo). Boxes grow with content
// rather than scrolling, per the design spec.
//
// Per-direction suppression:
//   - On the chief panel (`panelRole === 'chief'`), every box hides
//     the "You asked for" section — chief is the giver and never asks.
//   - In every panel, the chief peer box hides "They asked for" — same
//     reason from the other side.

import { Stack } from '@mui/material';
import type { PlayerID, Role, SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { RequestsBox } from './RequestsBox.tsx';
import { SectionHeading } from '../layout/SectionHeading.tsx';

const ROLE_LABEL: Record<Role, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  foreign: 'Foreign',
};

const peerLabelFor = (
  seat: PlayerID,
  roles: Role[],
): string => {
  const seatLabel = `P${Number(seat) + 1}`;
  if (roles.length === 0) return seatLabel;
  return `${roles.map((r) => ROLE_LABEL[r]).join(' / ')} (${seatLabel})`;
};

export interface RequestsRowProps {
  G: SettlementState;
  playerID: PlayerID | null | undefined;
  /** The role that owns the surrounding panel — drives the heading
   *  accent color so the "Requests" label matches the panel border. */
  panelRole: Role;
}

export function RequestsRow({ G, playerID, panelRole }: RequestsRowProps) {
  // Chief is the giver; they never ask. Hide the outgoing section in
  // each box so the chief panel doesn't imply the chief can ask.
  const hideOutgoing = panelRole === 'chief';
  if (playerID === undefined || playerID === null) return null;

  const peers = Object.keys(G.roleAssignments)
    .filter((seat) => seat !== playerID)
    .sort();
  if (peers.length === 0) return null;

  const requests = G.requests ?? [];

  return (
    <Stack spacing={0.75} aria-label="Help requests">
      <SectionHeading role={panelRole}>Requests</SectionHeading>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'stretch', flexWrap: 'wrap', rowGap: 1 }}
      >
        {peers.map((peerSeat) => {
          const peerRoles = rolesAtSeat(G.roleAssignments, peerSeat);
          const peerLabel = peerLabelFor(peerSeat, peerRoles);
          const fromThem = requests.filter(
            (r) => r.fromSeat === peerSeat && r.toSeat === playerID,
          );
          const toThem = requests.filter(
            (r) => r.fromSeat === playerID && r.toSeat === peerSeat,
          );
          // The chief peer box never carries inbound asks — chief
          // doesn't ask. Hide that section so it doesn't render an
          // empty "They asked for: (nothing)" implying chief could.
          const hideIncoming = peerRoles.includes('chief');
          return (
            <RequestsBox
              key={peerSeat}
              peerLabel={peerLabel}
              peerRole={peerRoles[0]}
              fromThem={fromThem}
              toThem={toThem}
              hideOutgoing={hideOutgoing}
              hideIncoming={hideIncoming}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}

export default RequestsRow;
