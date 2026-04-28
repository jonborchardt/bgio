// Board (04.5 + 09.1) — top-level board component.
//
// 09.1 retrofits the previous flat layout with `<BoardShell>`: chief along
// the top, the three other role panels on the sides, the center mat in the
// middle, and the status bar at the bottom. Each role panel is wrapped in a
// `<RoleSlot>` whose `expanded` flag is true when the local seat holds that
// role (or when `numPlayers === 1`, hot-seat solo).
//
// The role assignments header that used to live above the panels stays as a
// small banner above the shell — it's useful regardless of which seat is
// looking at the board.

import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from './game/index.ts';
import { rolesAtSeat } from './game/roles.ts';
import { ChiefPanel } from './ui/chief/ChiefPanel.tsx';
import { SciencePanel } from './ui/science/SciencePanel.tsx';
import { DomesticPanel } from './ui/domestic/DomesticPanel.tsx';
import { ForeignPanel } from './ui/foreign/ForeignPanel.tsx';
import { BoardShell } from './ui/layout/BoardShell.tsx';
import { RoleSlot } from './ui/layout/RoleSlot.tsx';
import { StatusBar } from './ui/layout/StatusBar.tsx';
import { CenterMat } from './ui/mat/CenterMat.tsx';
import { ChatPane } from './ui/chat/ChatPane.tsx';
import { ChatComposer } from './ui/chat/ChatComposer.tsx';

export function SettlementBoard(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const gameOver = ctx.gameover !== undefined;
  const seats = Object.keys(G.roleAssignments).sort();

  // 09.1: a role's slot is expanded when the local seat holds it OR when
  // we're in a single-player game (hot-seat solo: everything visible).
  const localRoles =
    playerID !== undefined && playerID !== null
      ? rolesAtSeat(G.roleAssignments, playerID)
      : [];
  const isSolo = ctx.numPlayers === 1;
  const expanded = (role: 'chief' | 'science' | 'domestic' | 'foreign') =>
    isSolo || localRoles.includes(role);

  return (
    <Box sx={{ width: 'min(100%, 60rem)', display: 'grid', gap: 3 }}>
      <Box component="header" sx={{ textAlign: 'center' }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, letterSpacing: '0.02em', mb: 0.5 }}
        >
          Settlement
        </Typography>
        <Typography
          sx={{
            fontWeight: 500,
            color: (t) =>
              gameOver ? t.palette.status.muted : t.palette.status.active,
          }}
        >
          {gameOver
            ? 'Game over'
            : `Player ${Number(ctx.currentPlayer) + 1}'s turn`}
        </Typography>
      </Box>

      <Stack component="section" spacing={1.5} aria-label="Role assignments">
        {seats.map((seat) => {
          const active = ctx.currentPlayer === seat && !gameOver;
          const roles = G.roleAssignments[seat] ?? [];
          return (
            <Paper
              key={seat}
              elevation={0}
              sx={{
                px: 2,
                py: 1.5,
                bgcolor: (t) => t.palette.card.surface,
                border: '1px solid',
                borderColor: (t) =>
                  active ? t.palette.status.active : 'transparent',
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: (t) => t.palette.status.muted }}
              >
                Player {Number(seat) + 1}
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {roles.join(', ')}
              </Typography>
            </Paper>
          );
        })}
      </Stack>

      <BoardShell
        chief={
          <RoleSlot expanded={expanded('chief')}>
            <ChiefPanel {...props} />
          </RoleSlot>
        }
        science={
          <RoleSlot expanded={expanded('science')}>
            <SciencePanel {...props} />
          </RoleSlot>
        }
        domestic={
          <RoleSlot expanded={expanded('domestic')}>
            <DomesticPanel {...props} />
          </RoleSlot>
        }
        foreign={
          <RoleSlot expanded={expanded('foreign')}>
            <ForeignPanel {...props} />
          </RoleSlot>
        }
        centerMat={<CenterMat {...props} />}
        status={
          <StatusBar
            phase={ctx.phase ?? null}
            currentPlayer={ctx.currentPlayer}
            round={G.round}
          />
        }
      />

      {/* 10.5: chat lives below the StatusBar as a sibling of BoardShell.
          `chatMessages` and `sendChatMessage` are bgio-Client-provided
          props (see boardgame.io's BoardProps definition); they're
          undefined under the headless test Client, so we tolerate that. */}
      <Stack component="section" aria-label="Chat" spacing={1}>
        <ChatPane chatMessages={props.chatMessages ?? []} />
        <ChatComposer
          onSend={(t) => props.sendChatMessage?.({ text: t, ts: Date.now() })}
          disabled={props.sendChatMessage === undefined}
        />
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          disabled={gameOver}
          onClick={() => moves.pass()}
        >
          End my turn
        </Button>
      </Box>
    </Box>
  );
}
