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

import { useContext } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerID, SettlementState } from './game/index.ts';
import { rolesAtSeat } from './game/roles.ts';
import { detectMode } from './clientMode.ts';
import type { StatusBarMode } from './ui/layout/StatusBar.tsx';
import { ChiefPanel } from './ui/chief/ChiefPanel.tsx';
import { SciencePanel } from './ui/science/SciencePanel.tsx';
import { DomesticPanel } from './ui/domestic/DomesticPanel.tsx';
import { ForeignPanel } from './ui/foreign/ForeignPanel.tsx';
import { BoardShell } from './ui/layout/BoardShell.tsx';
import { GameOverBanner } from './ui/layout/GameOverBanner.tsx';
import { PhaseHint } from './ui/layout/PhaseHint.tsx';
import { RoleSlot } from './ui/layout/RoleSlot.tsx';
import { SeatPicker } from './ui/layout/SeatPicker.tsx';
import { SeatPickerContext } from './ui/layout/SeatPickerContext.ts';
import { pickActiveSeat } from './ui/layout/activeSeat.ts';
import { StatusBar } from './ui/layout/StatusBar.tsx';
import type { GameOutcome } from './game/endConditions.ts';
import { CenterMat } from './ui/mat/CenterMat.tsx';
import { ChatPane } from './ui/chat/ChatPane.tsx';
import { ChatComposer } from './ui/chat/ChatComposer.tsx';

export function SettlementBoard(props: BoardProps<SettlementState>) {
  const { G, ctx, playerID } = props;
  const gameOver = ctx.gameover !== undefined;
  const seats = Object.keys(G.roleAssignments).sort();

  // 14.1 — App.tsx owns the hot-seat seat state and exposes a setter
  // through `SeatPickerContext`. In networked mode the provider is
  // absent (the lobby is the authority on which seat you hold), so
  // the picker falls back to its read-only badge.
  const seatCtx = useContext(SeatPickerContext);

  // 10.8 — spectator mode. `playerID === null` is bgio's "no seat,
  // watching only" connection (02.4's `playerView(G, ctx, null)`
  // redacts secret state). `undefined` happens under headless test
  // Clients that don't bind a player; we treat that as "no local seat"
  // for read-only purposes too (panels render summary view, no action
  // buttons). We split the two:
  //   - isSpectator: explicitly watching (null) — show "Spectating" tag.
  //   - hasSeat: there is a local seat (defined and not null).
  const isSpectator = playerID === null;
  const hasSeat = playerID !== undefined && playerID !== null;

  // 14.3 — actual client mode for the StatusBar "Mode" tag. A null
  // local seat in networked mode is a spectator (10.8); everything
  // else just reports the build-time mode.
  const clientMode = detectMode();
  const statusMode: StatusBarMode | undefined = isSpectator
    ? 'spectating'
    : clientMode === 'networked'
      ? 'networked'
      : 'hotseat';

  // 09.1: a role's slot is expanded when the local seat holds it OR when
  // we're in a single-player game (hot-seat solo: everything visible).
  const localRoles = hasSeat
    ? rolesAtSeat(G.roleAssignments, playerID)
    : [];
  const isSolo = ctx.numPlayers === 1;
  const expanded = (role: 'chief' | 'science' | 'domestic' | 'foreign') =>
    isSolo || localRoles.includes(role);

  // 14.3 — hide the standalone CenterMat row when the chief panel is
  // visible. ChiefPanel's CircleEditors already render every non-chief
  // seat's circle plus the bank summary; the standalone row was a
  // duplicate that confused playtesters.
  const showCenterMat = !expanded('chief');

  return (
    <Box sx={{ width: 'min(100%, 60rem)', display: 'grid', gap: 3 }}>
      {/* 14.12 — header reads the active seat from `ctx.activePlayers`
          (with `ctx.currentPlayer` as a fallback) so the round-2
          chiefPhase no longer mis-labels itself "Player 4's turn"
          just because that's who happened to move last in
          othersPhase. */}
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
            : (() => {
                const active = pickActiveSeat({
                  activePlayers: ctx.activePlayers,
                  currentPlayer: ctx.currentPlayer,
                  roleAssignments: G.roleAssignments,
                  othersDone: G.othersDone,
                  localSeat: playerID,
                });
                return `${active.label}'s turn`;
              })()}
        </Typography>
      </Box>

      {/* 14.5 — Game-over banner. Reads bgio's GameOutcome from
          ctx.gameover and renders win / timeUp copy with a
          "Play again" reload button. */}
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

      {/* 14.1 — Seat picker. In hot-seat we expose a tab strip so the
          single-tab user can switch which seat they're driving (without
          this every non-chief role panel returns null). In networked
          mode the lobby is the authority on `playerID`, so we render a
          read-only "You are Player N" badge. Spectators (`playerID ===
          null`) get nothing — they have no seat to mirror. */}
      {playerID !== undefined && playerID !== null ? (
        <SeatPicker
          numPlayers={ctx.numPlayers as 1 | 2 | 3 | 4}
          current={playerID as PlayerID}
          roleAssignments={G.roleAssignments}
          onChange={
            seatCtx ? (seat: PlayerID) => seatCtx.setSeat(seat) : undefined
          }
        />
      ) : null}

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
        centerMat={showCenterMat ? <CenterMat {...props} /> : null}
        status={
          <Box>
            <StatusBar
              phase={ctx.phase ?? null}
              currentPlayer={ctx.currentPlayer}
              round={G.round}
              mode={statusMode}
            />
            {/* 14.6 — one-line "what you can do now" hint. */}
            <Box sx={{ mt: 0.5 }}>
              <PhaseHint
                phase={ctx.phase ?? null}
                stage={
                  hasSeat ? ctx.activePlayers?.[playerID] : undefined
                }
                rolesAtSeat={localRoles}
                isSpectator={isSpectator}
              />
            </Box>
          </Box>
        }
      />

      {/* 10.5 + 14.7: chat lives below the StatusBar as a sibling of
          BoardShell. `chatMessages` and `sendChatMessage` are
          bgio-Client-provided props that only exist under the
          multiplayer transport — hot-seat has no transport, so we
          render nothing rather than a permanently-empty pane.
          (Headless test Clients also see no transport; the gate is
          the same. Spectators in networked mode keep chat visible
          read-only — `sendChatMessage` is undefined for them and
          ChatComposer disables itself.) */}
      {clientMode === 'networked' ? (
        <Stack component="section" aria-label="Chat" spacing={1}>
          <ChatPane chatMessages={props.chatMessages ?? []} />
          <ChatComposer
            onSend={(t) =>
              props.sendChatMessage?.({ text: t, ts: Date.now() })
            }
            disabled={props.sendChatMessage === undefined}
          />
        </Stack>
      ) : null}

      {/* 14.2 removed the legacy bottom "End my turn" stub that called
          `pass()`. Chief uses ChiefPanel's own "End my turn" button
          (chiefEndPhase); every non-chief role uses the matching
          per-panel `<role>SeatDone` button. */}
    </Box>
  );
}
