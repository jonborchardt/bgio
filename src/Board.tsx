// Board — top-level board component.
//
// Linear stack:
//   1. Header — "Settlement" title plus a single-line turn/round line
//      ("It's your turn — Round 3" or "Waiting on Chief — Round 3").
//   2. CenterMat — the row of per-seat tiles. In hot-seat mode each
//      tile is a clickable seat tab (replacing the older SeatPicker
//      Tabs strip); in networked mode tiles are read-only.
//   3. RequestsRow — per-peer help-request boxes for the local seat.
//   4. Role panel(s) the local seat owns — the player's action surface.
//
// Phase / player / round / mode debug info is no longer surfaced to
// players; it lives inside `<DevSidebar>` (dev-only fly-out) so the
// player view stays focused on "your turn / not your turn".

import { Box, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from './game/index.ts';
import { rolesAtSeat } from './game/roles.ts';
import { ChiefPanel } from './ui/chief/ChiefPanel.tsx';
import { SciencePanel } from './ui/science/SciencePanel.tsx';
import { DomesticPanel } from './ui/domestic/DomesticPanel.tsx';
import { DefensePanel } from './ui/defense/DefensePanel.tsx';
import { GameOverBanner } from './ui/layout/GameOverBanner.tsx';
import { pickActiveSeat } from './ui/layout/activeSeat.ts';
import type { GameOutcome } from './game/endConditions.ts';
import { SeatTiles } from './ui/mat/CenterMat.tsx';
import { RelationshipsModalHost } from './ui/relationships/RelationshipsModalHost.tsx';
import { DevSidebar } from './ui/layout/DevSidebar.tsx';
import { EventLogDrawer } from './ui/log/EventLogDrawer.tsx';

const ROLE_TITLE: Record<'chief' | 'science' | 'domestic' | 'defense', string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  defense: 'Defense',
};

export function SettlementBoard(props: BoardProps<SettlementState>) {
  const { G, ctx, playerID } = props;
  const gameOver = ctx.gameover !== undefined;

  // Spectator vs seated. `playerID === null` is bgio's "watching only"
  // connection (02.4's `playerView(G, ctx, null)` redacts secrets);
  // `undefined` is a headless test client.
  const hasSeat = playerID !== undefined && playerID !== null;

  // A role's panel is rendered when the local seat holds it OR when we're
  // in a single-player game (hot-seat solo: everything visible).
  const localRoles = hasSeat
    ? rolesAtSeat(G.roleAssignments, playerID)
    : [];
  const isSolo = ctx.numPlayers === 1;
  const expanded = (role: 'chief' | 'science' | 'domestic' | 'defense') =>
    isSolo || localRoles.includes(role);

  // Build the single-line turn-status string the player sees under the
  // title. We collapse activeSeat info into "It's your turn" / "Waiting
  // on Chief" / "Game over" plus the round number, so the player view
  // never needs to spell out phase / activePlayers / mode.
  const active = pickActiveSeat({
    activePlayers: ctx.activePlayers,
    currentPlayer: ctx.currentPlayer,
    phase: ctx.phase,
    roleAssignments: G.roleAssignments,
    othersDone: G.othersDone,
    localSeat: playerID,
  });
  const activeRolesAtSeat = G.roleAssignments[active.seat] ?? [];
  const activeRoleLabel = activeRolesAtSeat
    .map((r) => ROLE_TITLE[r as 'chief' | 'science' | 'domestic' | 'defense'])
    .filter(Boolean)
    .join(' · ');
  const turnLine = gameOver
    ? `Game over — Round ${G.round}`
    : active.isLocal
      ? `It's your turn — Round ${G.round}`
      : `Waiting on ${activeRoleLabel || `Player ${Number(active.seat) + 1}`} — Round ${G.round}`;

  const playArea = (
    <Stack spacing={3} sx={{ minWidth: 0 }}>
      <Box component="header" sx={{ textAlign: 'center' }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, letterSpacing: '0.02em', mb: 0.5 }}
        >
          Settlement
        </Typography>
        <Typography
          aria-label="Turn status"
          sx={{
            fontWeight: 600,
            color: (t) =>
              gameOver
                ? t.palette.status.muted
                : active.isLocal
                  ? t.palette.status.active
                  : t.palette.status.muted,
          }}
        >
          {turnLine}
        </Typography>
      </Box>

      {gameOver ? (
        <GameOverBanner
          outcome={ctx.gameover as GameOutcome}
          onPlayAgain={
            typeof window !== 'undefined'
              ? () => window.location.reload()
              : undefined
          }
        />
      ) : null}

      {/* Seat tiles fuse into the active role panel below: zero-gap
          Stack + selected tile drops its bottom border (Circle.tsx) +
          role panel squares its top corners (RolePanel.tsx). The
          trade-request slot lives inside the ChiefPanel as its own
          "Trade Requests" section — it's chief-private, so it's not
          rendered at the board level. */}
      <Stack spacing={0}>
        <SeatTiles {...props} />
        <Stack spacing={3}>
          {expanded('chief') ? <ChiefPanel {...props} /> : null}
          {expanded('science') ? <SciencePanel {...props} /> : null}
          {expanded('domestic') ? <DomesticPanel {...props} /> : null}
          {expanded('defense') ? <DefensePanel {...props} /> : null}
        </Stack>
      </Stack>

      <RelationshipsModalHost matchState={G} />
      <DevSidebar
        moves={props.moves}
        phase={ctx.phase ?? null}
        currentPlayer={ctx.currentPlayer}
        round={G.round}
      />
      <EventLogDrawer log={props.log ?? []} G={G} />
    </Stack>
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '60rem',
        mx: 'auto',
        px: { xs: 1, md: 2 },
      }}
    >
      {playArea}
    </Box>
  );
}
