// DomesticPanel — the domestic seat's per-turn UI.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `domestic` role, OR
//   - `G.domestic` is missing (legacy fixtures pre-06.1).
//
// Otherwise we render:
//   1. <Hand>           — building cards available to buy and place.
//   2. <BuildingGrid>   — placed buildings and a one-cell ring of empty
//                          slots; clicking a legal empty slot fires
//                          `domesticBuyBuilding(name, x, y)`.
//
// Production is automatic: it fires at `othersPhase.turn.onBegin` for
// every seat that holds the domestic role, before the seat acts. There's
// no decision in produce, so there's no button.
//
// Local React state holds the currently-selected hand card. Selection is
// the panel-local "I'm placing this card" mode; clicking the same card
// again clears it.

import { useContext, useMemo, useState } from 'react';
import { Button, Stack } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { Hand } from './Hand.tsx';
import { BuildingGrid } from './BuildingGrid.tsx';
import { RolePanel } from '../layout/RolePanel.tsx';
import { SectionHeading } from '../layout/SectionHeading.tsx';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';
import { UndoButton } from '../layout/UndoButton.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { nextSeatAfterDone } from '../layout/nextSeat.ts';
import { RequestHelpButton } from '../requests/RequestHelpButton.tsx';
import { RequestsRow } from '../requests/RequestsRow.tsx';
import { buildResourceSlices } from '../requests/useResourceSlice.ts';
import { idForBuilding, idForTech } from '../../cards/registry.ts';
import { buildingCost } from '../../data/index.ts';
import { RESOURCES } from '../../game/resources/types.ts';

export function DomesticPanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);

  // Hooks must be called unconditionally — hold the panel-local "selected
  // hand card" state above the early-return guards. (When the panel is
  // hidden, the state simply has no consumers.)
  const [selectedCardName, setSelectedCardName] = useState<
    string | undefined
  >(undefined);

  // Defense redesign 3.2 — pooled non-chief stash. The center vault
  // (D2 / D3) shows this number on its face so the table reads at a
  // glance how much resource is at risk if a threat reaches center.
  // Compute once per render off `G.mats` (chief seat is intentionally
  // absent — see `initialMats`). Resource breakdown is forwarded to
  // the center-tile tooltip so a curious player can drill in.
  // Hooks-rule: `useMemo` must run on every render, so it sits above
  // the early-return guards alongside the other hooks.
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

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('domestic')) return null;

  const domestic = G.domestic;
  if (domestic === undefined) return null;

  const canAct = ctx.activePlayers?.[playerID] === 'domesticTurn';
  // 14.13 — disable + relabel End-my-turn after the seat flips done.
  const alreadyDone = G.othersDone?.[playerID] === true;

  const activeCard = selectedCardName
    ? domestic.hand.find((c) => c.name === selectedCardName)
    : undefined;

  const handleSelect = (name: string): void => {
    setSelectedCardName((prev) => (prev === name ? undefined : name));
  };

  const handlePlace = (x: number, y: number): void => {
    if (selectedCardName === undefined) return;
    moves.domesticBuyBuilding(selectedCardName, x, y);
    // Clear selection after dispatch — buy moves consume one hand entry, and
    // even on INVALID_MOVE the user can re-select to retry.
    setSelectedCardName(undefined);
  };

  const handleSeatDone = (): void => {
    moves.domesticSeatDone();
    if (seatCtx) seatCtx.setSeat(nextSeatAfterDone(G, playerID));
  };

  const defenseUnits = G.defense?.inPlay;

  // The hand IS the source of truth for "what this seat can build" —
  // buildings are added to it by setup (starters), by `grantTechUnlocks`
  // when a tech is played, and (later) by other card-spawning effects.
  // The previous "Requires X" UI filter was a second gate on top of that
  // and hid most of the hand because the requirement text often listed
  // multiple prereqs (e.g. Library "Requires Library (tech) + Reading"),
  // any one of which being unsatisfied dropped the card. The engine
  // already controls which buildings reach the hand; the UI just
  // renders the hand directly.
  const visibleHand = domestic.hand;

  return (
    <RolePanel
      role="domestic"
      connectedAbove
      actions={
        <>
          <GraveyardButton
            role="domestic"
            entries={G.graveyards?.[playerID] ?? []}
          />
          <UndoButton
            G={G}
            playerID={playerID}
            canAct={canAct && !alreadyDone}
            onUndo={() => moves.undoLast()}
          />
          <Button
            variant="contained"
            disabled={!canAct || alreadyDone}
            onClick={handleSeatDone}
            aria-label="End my Domestic turn"
            sx={{
              bgcolor: (t) => t.palette.role.domestic.main,
              color: (t) => t.palette.role.domestic.contrastText,
              '&:hover': {
                bgcolor: (t) => t.palette.role.domestic.dark,
              },
            }}
          >
            {alreadyDone ? 'Turn ended' : 'End my turn'}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <RequestsRow G={G} playerID={playerID} panelRole="domestic" />

        <Hand
          hand={visibleHand}
          techs={domestic.techHand ?? []}
          canAct={canAct && !alreadyDone}
          onPlayTech={(name) => moves.domesticPlayTech(name)}
          selectedName={selectedCardName}
          onSelect={handleSelect}
          stash={G.mats?.[playerID]?.stash}
          emptyHint="No buildings unlocked yet — complete a green science card to gain Civic techs that enable buildings."
          renderBuildingHelp={(def) => (
            <RequestHelpButton
              G={G}
              playerID={playerID}
              moves={moves}
              fromRole="domestic"
              targetId={idForBuilding(def)}
              targetLabel={def.name}
              slices={buildResourceSlices({
                G,
                fromSeat: playerID,
                fromRole: 'domestic',
                cost: buildingCost(def),
                have: G.mats?.[playerID]?.stash,
              })}
            />
          )}
          renderTechHelp={(tech) => (
            <RequestHelpButton
              G={G}
              playerID={playerID}
              moves={moves}
              fromRole="domestic"
              targetId={idForTech(tech)}
              targetLabel={tech.name}
              slices={buildResourceSlices({
                G,
                fromSeat: playerID,
                fromRole: 'domestic',
                cost: tech.costBag ?? {},
                have: G.mats?.[playerID]?.stash,
              })}
            />
          )}
        />

        <SectionHeading role="domestic">Village</SectionHeading>
        <BuildingGrid
          grid={domestic.grid}
          activeCard={activeCard}
          onPlace={handlePlace}
          units={defenseUnits}
          pooledTotal={pooled.total}
          pooledBreakdown={pooled.breakdown}
        />
      </Stack>
    </RolePanel>
  );
}

export default DomesticPanel;
