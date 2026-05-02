// Board (04.5) — top-level board component.
//
// Linear, full-width stack:
//   1. StatusBar (phase / player / round / mode)
//   2. SeatPicker (debug seat chooser)
//   3. CenterMat (per-seat player mats: in / out / stash + trade slot)
//   4. Role panel(s) the local seat owns — the player's action surface

import { useContext } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerID, SettlementState } from './game/index.ts';
import { rolesAtSeat } from './game/roles.ts';
import { detectMode } from './clientMode.ts';
import type { StatusBarMode } from './ui/layout/StatusBar.tsx';
import { ChiefPanel } from './ui/chief/ChiefPanel.tsx';
import { SciencePanel } from './ui/science/SciencePanel.tsx';
import { DomesticPanel } from './ui/domestic/DomesticPanel.tsx';
import { ForeignPanel } from './ui/foreign/ForeignPanel.tsx';
import { GameOverBanner } from './ui/layout/GameOverBanner.tsx';
import { PhaseHint } from './ui/layout/PhaseHint.tsx';
import { SeatPicker } from './ui/layout/SeatPicker.tsx';
import { SeatPickerContext } from './ui/layout/SeatPickerContext.ts';
import { pickActiveSeat } from './ui/layout/activeSeat.ts';
import { StatusBar } from './ui/layout/StatusBar.tsx';
import type { GameOutcome } from './game/endConditions.ts';
import { CenterMat } from './ui/mat/CenterMat.tsx';
import { ChatSection } from './ui/chat/ChatSection.tsx';
import { RelationshipsModalHost } from './ui/relationships/RelationshipsModalHost.tsx';
import { DevSidebar } from './ui/layout/DevSidebar.tsx';

export function SettlementBoard(props: BoardProps<SettlementState>) {
  const { G, ctx, playerID } = props;
  const gameOver = ctx.gameover !== undefined;

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

  // A role's panel is rendered when the local seat holds it OR when we're
  // in a single-player game (hot-seat solo: everything visible).
  const localRoles = hasSeat
    ? rolesAtSeat(G.roleAssignments, playerID)
    : [];
  const isSolo = ctx.numPlayers === 1;
  const expanded = (role: 'chief' | 'science' | 'domestic' | 'foreign') =>
    isSolo || localRoles.includes(role);

  return (
    <Box sx={{ width: 'min(100%, 60rem)', mx: 'auto', display: 'grid', gap: 3 }}>
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

      {/* 1. Phase / player / round / mode bar. */}
      <Box>
        <StatusBar
          phase={ctx.phase ?? null}
          currentPlayer={ctx.currentPlayer}
          round={G.round}
          mode={statusMode}
        />
        <Box sx={{ mt: 0.5 }}>
          <PhaseHint
            phase={ctx.phase ?? null}
            stage={hasSeat ? ctx.activePlayers?.[playerID] : undefined}
            rolesAtSeat={localRoles}
            isSpectator={isSpectator}
          />
        </Box>
      </Box>

      {/* 2. Debug player view chooser. Hot-seat: tab strip to switch seat.
          Networked: read-only "You are Player N" badge. Spectators (null
          playerID) get nothing — they have no seat to mirror. */}
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


      {/* 3. Player mats / stats of all seats (incl. other players). */}
      <CenterMat {...props} />

      {/* 4. Chat — placed above the role action area so it's visible
          while a player is deciding what to do. `chatMessages` and
          `sendChatMessage` are bgio-Client-provided props under both
          the SocketIO and Local transports, so hot-seat and networked
          both render the panel. Spectators (no `sendChatMessage`) get
          a read-only view. ChatSection adds an optimistic local outbox
          so the sender always sees their own message even if bgio's
          Local transport echo is dropped or duplicated under hot-seat
          seat-switching. */}
      {props.sendChatMessage !== undefined || (props.chatMessages?.length ?? 0) > 0 ? (
        <ChatSection
          chatMessages={props.chatMessages ?? []}
          sendChatMessage={props.sendChatMessage}
          localSender={playerID ?? null}
          roleAssignments={G.roleAssignments}
        />
      ) : null}

      {/* 5. The local seat's action element(s) — the role panel(s) the
          local player owns. In solo mode (hot-seat 1p), all four render. */}
      <Stack spacing={3}>
        {expanded('chief') ? <ChiefPanel {...props} /> : null}
        {expanded('science') ? <SciencePanel {...props} /> : null}
        {expanded('domestic') ? <DomesticPanel {...props} /> : null}
        {expanded('foreign') ? <ForeignPanel {...props} /> : null}
      </Stack>

      {/* 14.2 removed the legacy bottom "End my turn" stub that called
          `pass()`. Chief uses ChiefPanel's own "End my turn" button
          (chiefEndPhase); every non-chief role uses the matching
          per-panel `<role>SeatDone` button. */}

      {/* Relationships modal lives here (inside the bgio Client) so it
          can forward the live `G` to `buildCardGraph`. The modal itself
          is a Dialog portalled to document.body, so positioning under
          the Board is fine. */}
      <RelationshipsModalHost matchState={G} />
      {/* DevSidebar mounts inside Board so it has `props.moves` access
          for testing shortcuts (e.g. "give bank +10 of each"). The
          sidebar self-gates on `import.meta.env.DEV` and renders nothing
          in production builds. */}
      <DevSidebar moves={props.moves} />
    </Box>
  );
}
