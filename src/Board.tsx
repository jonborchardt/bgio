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

import { useMemo, useState } from 'react';
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
import { CenterBurnBanner } from './ui/center/CenterBurnBanner.tsx';
import { RelationshipsModalHost } from './ui/relationships/RelationshipsModalHost.tsx';
import { DevSidebar } from './ui/layout/DevSidebar.tsx';
import { EventLogDrawer } from './ui/log/EventLogDrawer.tsx';
import { TrackStrip } from './ui/track/TrackStrip.tsx';
import {
  countCompletedScience,
  sumUnitStrength,
} from './game/track/boss.ts';
import {
  ResolveAnimationProvider,
  ResolveTraceWatcher,
} from './ui/track/resolveAnimationContext.tsx';
import { BuildingGrid } from './ui/domestic/BuildingGrid.tsx';
import { VillagePlacementContext } from './ui/layout/VillagePlacementContext.ts';
import { RESOURCES } from './game/resources/types.ts';

const ROLE_TITLE: Record<'chief' | 'science' | 'domestic' | 'defense', string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  defense: 'Defense',
};

export function SettlementBoard(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const gameOver = ctx.gameover !== undefined;

  // Post-3.9 preference sweep — the BuildingGrid was lifted out of
  // DomesticPanel / DefensePanel into the board so every seat sees
  // the village + the threat-resolution path overlay. The board owns
  // the placement state (which building / which unit is armed); the
  // role panels publish into it via VillagePlacementContext when the
  // local seat selects from their hand.
  const [selectedBuildingName, setSelectedBuildingName] = useState<
    string | undefined
  >(undefined);
  const [selectedUnitName, setSelectedUnitName] = useState<string | undefined>(
    undefined,
  );

  const placementContextValue = useMemo(
    () => ({
      selectedBuildingName,
      setSelectedBuildingName,
      selectedUnitName,
      setSelectedUnitName,
    }),
    [selectedBuildingName, selectedUnitName],
  );

  // Pooled non-chief stash total — fed into the centre tile so every
  // seat reads the at-risk number at a glance (D2 / 3.2). Computed
  // once per render off `G.mats`; the chief seat is intentionally
  // absent from `mats`.
  const pooled = useMemo(() => {
    const breakdown = RESOURCES.map((r) => {
      let amount = 0;
      const mats = G.mats ?? {};
      for (const seatMat of Object.values(mats)) {
        amount += seatMat?.stash?.[r] ?? 0;
      }
      return { resource: r, amount };
    });
    const total = breakdown.reduce((s, b) => s + b.amount, 0);
    return { total, breakdown };
  }, [G.mats]);

  // Resolve the armed building name to its def via the local seat's
  // domestic hand. This is only meaningful when the local seat owns
  // domestic; otherwise the active card is simply undefined and the
  // grid renders read-only.
  const activeBuildingDef = useMemo(() => {
    if (selectedBuildingName === undefined) return undefined;
    return G.domestic?.hand.find((c) => c.name === selectedBuildingName);
  }, [selectedBuildingName, G.domestic]);

  const handlePlaceBuilding = (x: number, y: number): void => {
    if (selectedBuildingName === undefined) return;
    moves.domesticBuyBuilding(selectedBuildingName, x, y);
    setSelectedBuildingName(undefined);
  };

  const handlePickUnitCell = (cellKey: string): void => {
    if (selectedUnitName === undefined) return;
    moves.defenseBuyAndPlace(selectedUnitName, cellKey);
    setSelectedUnitName(undefined);
  };

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

      {/* Defense redesign 3.1 — global event track. Sits above the
          center mat, full width. The strip reads `G.track` directly:
          the just-flipped card lights up the current slot during the
          round it was flipped, and earlier flips fill the past row.
          There is no face-up "next" telegraph — the village only
          sees what has actually resolved. The boss card is fed in
          separately so the BossReadout (3.5) tracks the village's
          progress against thresholds from round 1 onward. */}
      {G.track !== undefined ? (
        (() => {
          const history = G.track.history;
          const flippedThisRound = G.track.flippedThisRound === true;
          // The just-flipped card lives at the end of `history` and
          // only renders in the "current" slot during the round it
          // was flipped — at end-of-round it slides into the past
          // row (the round-end hook clears `flippedThisRound`).
          const currentCard =
            flippedThisRound && history.length > 0
              ? history[history.length - 1]
              : undefined;
          const pastCards =
            currentCard !== undefined
              ? history.slice(0, history.length - 1)
              : history;
          // Total face-down cards remaining. With the telegraph slot
          // gone the whole `upcoming` array is face-down.
          const upcomingCount = G.track.upcoming.length;
          // Locate the boss card so the readout can track thresholds
          // throughout the game. The 2.1 loader guarantees there is
          // exactly one boss card and that it sits in phase 10 — so
          // it lives at the end of `upcoming` until it flips, then
          // moves to `history`. We search both so the readout stays
          // visible even after the boss flip resolves. `bossLooming`
          // tells the readout to render in its subdued/desaturated
          // preview treatment so the table doesn't mistake it for an
          // already-flipped card.
          const bossInUpcoming = G.track.upcoming.find(
            (c) => c.kind === 'boss',
          );
          const bossCard =
            bossInUpcoming ?? G.track.history.find((c) => c.kind === 'boss');
          const bossLooming = bossInUpcoming !== undefined;
          // Defense redesign 3.5 — village totals for the boss
          // readout. We compute them unconditionally (cheap pure
          // derivations from `G`) and only the strip's boss-readout
          // path actually consumes them. Reusing the boss-resolver
          // helpers (`countCompletedScience`, `sumUnitStrength`)
          // keeps the readout's met / unmet logic identical to
          // `resolveBoss`'s threshold check at flip time, so the
          // table can trust "what the readout says" exactly equals
          // "what the boss will count when it flips."
          const villageTotals = {
            science: countCompletedScience(G),
            economy: G.bank.gold ?? 0,
            military: sumUnitStrength(G),
          };
          return (
            <TrackStrip
              history={pastCards}
              current={currentCard}
              upcomingCount={upcomingCount}
              phase={G.track.currentPhase}
              boss={bossCard}
              bossLooming={bossLooming}
              villageTotals={villageTotals}
            />
          );
        })()
      ) : null}

      {/* Post-3.9 preference sweep — the village grid sits at the
          board level so every seat (chief / science / domestic /
          defense / spectators) watches the same map. Threat-resolve
          path overlays render inside this grid via the existing
          ResolveAnimationProvider, so the entire table sees the
          attack animation when a flip resolves. The grid is interactive
          only for the seat whose role is armed — domestic placement
          when `activeBuildingDef` is set, defense placement when
          `selectedUnitName` is set; otherwise it's read-only. */}
      {G.domestic !== undefined ? (
        <BuildingGrid
          grid={G.domestic.grid}
          activeCard={activeBuildingDef}
          onPlace={handlePlaceBuilding}
          units={G.defense?.inPlay}
          pooledTotal={pooled.total}
          pooledBreakdown={pooled.breakdown}
          unitPlacement={{
            selectedUnitName,
            onPick: handlePickUnitCell,
          }}
        />
      ) : null}

      {/* Seat tiles fuse into the active role panel below: zero-gap
          Stack + selected tile drops its bottom border (Circle.tsx) +
          role panel squares its top corners (RolePanel.tsx). The
          trade-request slot lives inside the ChiefPanel as its own
          "Trade Requests" section — it's chief-private, so it's not
          rendered at the board level. */}
      <Stack spacing={0}>
        {/* Defense redesign 3.4 — center-burn banner. Floats above the
            seat-tile row when a threat reaches the village vault and
            the resolver writes a `centerBurnDetail` onto the latest
            trace. The wrapper is `position: relative` so the banner's
            absolute layout resolves against the tile row; the banner
            itself is `pointer-events: none` so seat-tile clicks pass
            through. */}
        <Box sx={{ position: 'relative' }}>
          <CenterBurnBanner lastResolve={G.track?.lastResolve} />
          <SeatTiles {...props} />
        </Box>
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
      {/* Defense redesign 3.3 — animation queue + watcher for path
          overlay. The provider wraps the whole board so any consumer
          (BuildingGrid in DomesticPanel, future track/center widgets)
          reads from the same queue; the watcher pushes
          `G.track.lastResolve` updates onto it as the engine resolves
          flips. Mounted unconditionally — when `G.track` is missing
          (older fixtures) the watcher pushes `undefined` and no-ops. */}
      <ResolveAnimationProvider>
        <ResolveTraceWatcher lastResolve={G.track?.lastResolve} />
        <VillagePlacementContext.Provider value={placementContextValue}>
          {playArea}
        </VillagePlacementContext.Provider>
      </ResolveAnimationProvider>
    </Box>
  );
}
