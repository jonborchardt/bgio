// PlayerMatTile (formerly "Circle") — a single per-seat tile on the
// CenterMat. Shows the seat's three resource bags (in / out / stash)
// plus an active-turn outline when this seat holds the active turn.
//
// The role(s) the seat holds drive the accent color (chief priority).
// Chief seats own no mat — `mat === null` renders the role label, and
// when an optional `bankView` is supplied the chief tile also shows the
// bank as Income (new this round) and Stash (carryover) lanes.

import { Box, Paper, Stack, Typography } from '@mui/material';
import type { PlayerID, Role, PlayerMat } from '../../game/types.ts';
import type { ResourceBag as ResourceBagType } from '../../game/resources/types.ts';
import { ResourceBag } from '../resources/ResourceBag.tsx';

const ROLE_ACCENT_PRIORITY: ReadonlyArray<Role> = [
  'chief',
  'science',
  'domestic',
  'foreign',
];

const accentRoleFor = (roles: ReadonlyArray<Role>): Role | undefined =>
  ROLE_ACCENT_PRIORITY.find((r) => roles.includes(r));

const titleCase = (s: string): string =>
  s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);

export interface BankView {
  /** Resources that arrived in the bank this round (gross positive deltas). */
  income: ResourceBagType;
  /** Carryover from earlier rounds: current bank balance minus this round's net inflow, clamped at zero. */
  stash: ResourceBagType;
  /** When true, suppress the Income lane (used during chiefPhase, when income has merged into the distributable stash). */
  hideIncome?: boolean;
}

export interface CircleProps {
  seat: PlayerID;
  /** When null, the seat has no mat (chief). */
  mat: PlayerMat | null;
  roles: ReadonlyArray<Role>;
  active?: boolean;
  /** When set on a non-active seat, render a "Waiting for {label}"
   *  caption (the role label of whoever currently holds the turn). */
  waitingFor?: string;
  /** Chief-only: bank breakdown to render in place of mat lanes. */
  bankView?: BankView;
}

const totalOf = (bag: PlayerMat['in']): number => {
  let t = 0;
  for (const v of Object.values(bag)) t += v;
  return t;
};

export function Circle({ seat, mat, roles, active, waitingFor, bankView }: CircleProps) {
  const accent = accentRoleFor(roles);
  const label = roles.length > 0 ? roles.map(titleCase).join(' · ') : '—';
  const ariaLabel = `${label} mat (Player ${Number(seat) + 1})`;

  return (
    <Paper
      elevation={0}
      aria-label={ariaLabel}
      sx={{
        px: 1.5,
        py: 1,
        width: '100%',
        minWidth: 0,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) =>
          active
            ? t.palette.status.active
            : accent
              ? t.palette.role[accent].main
              : t.palette.card.surface,
        borderRadius: 1,
        boxShadow: (t) =>
          active ? `0 0 0 1px ${t.palette.status.active}` : 'none',
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
      }}
    >
      <Stack spacing={0.75} sx={{ width: '100%' }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '0.02em',
              color: (t) =>
                accent ? t.palette.role[accent].main : t.palette.card.text,
            }}
          >
            {label}
          </Typography>
          {!active && waitingFor !== undefined ? (
            <Stack
              spacing={0}
              sx={{ alignItems: 'flex-end', lineHeight: 1.1 }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.muted,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  lineHeight: 1.1,
                }}
              >
                Waiting for
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.muted,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  lineHeight: 1.1,
                }}
              >
                {waitingFor}
              </Typography>
            </Stack>
          ) : null}
        </Stack>

        {mat === null ? (
          bankView !== undefined ? (
            <Stack spacing={0.5}>
              {bankView.hideIncome ? null : (
                <MatLane
                  label="Income"
                  bag={bankView.income}
                  empty={totalOf(bankView.income) === 0}
                />
              )}
              <MatLane
                label="Stash"
                bag={bankView.stash}
                empty={totalOf(bankView.stash) === 0}
              />
            </Stack>
          ) : null
        ) : (
          <Stack spacing={0.5}>
            <FlowLane mat={mat} />
            <MatLane
              label="Stash"
              bag={mat.stash}
              empty={totalOf(mat.stash) === 0}
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

// A non-chief seat is never simultaneously holding income and produced
// goods (chief sweeps `out` at the start of their turn, then drops new
// income in `in` for the seat to take next; the seat's `produce` move
// runs after its `in` has already drained to `stash`). So the mat tile
// shows ONE flow lane, swapped by which side currently has tokens.
function FlowLane({ mat }: { mat: PlayerMat }) {
  const inTotal = totalOf(mat.in);
  const outTotal = totalOf(mat.out);
  if (inTotal > 0) {
    return <MatLane label="Income" bag={mat.in} empty={false} />;
  }
  if (outTotal > 0) {
    return <MatLane label="Produced" bag={mat.out} empty={false} />;
  }
  // Idle (nothing in either): pick "Income" as the resting label so the
  // tile keeps a stable layout while the round is mid-flight.
  return <MatLane label="Income" bag={mat.in} empty={true} />;
}

interface MatLaneProps {
  label: string;
  bag: PlayerMat['in'];
  empty: boolean;
}

function MatLane({ label, bag, empty }: MatLaneProps) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Typography
        variant="caption"
        sx={{
          color: (t) => t.palette.status.muted,
          fontWeight: 600,
          minWidth: '2.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
        aria-label={`${label} lane`}
      >
        {label}
      </Typography>
      {empty ? (
        <Box
          aria-hidden
          sx={{
            color: (t) => t.palette.status.muted,
            fontSize: '0.75rem',
            opacity: 0.6,
          }}
        >
          —
        </Box>
      ) : (
        <ResourceBag bag={bag} />
      )}
    </Stack>
  );
}

export default Circle;
