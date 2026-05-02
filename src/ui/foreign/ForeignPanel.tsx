// ForeignPanel (07.7) — the foreign seat's per-turn UI.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `foreign` role, OR
//   - `G.foreign` is missing (legacy fixtures pre-07.1).
//
// Otherwise we render:
//   1. Foreign hand row — recruit (+1) buttons per UnitDef in the hand.
//   2. <Army>           — count-collapsed list of in-play units, each with a
//                          Release button.
//   3. <Decks>          — Battle / Trade decks with Flip buttons.
//   4. <BattlePanel>    — visible only when `inFlight.battle !== null`;
//                          opens the AssignDamageDialog.
//   5. "Pay Upkeep"     — fires `foreignUpkeep()`.
//
// Stage gating: most actions require `ctx.activePlayers?.[playerID] ===
// 'foreignTurn'`. Assign-damage requires `'foreignAwaitingDamage'` (the
// stage `foreignFlipBattle` pushes the seat into).

import { useContext } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import type { DamageAllocation } from '../../game/roles/foreign/battleResolver.ts';
import {
  computeForeignUpkeepGold,
  upkeepableUnits,
} from '../../game/roles/foreign/upkeep.ts';
import { computeUnitRecruitCostBag } from '../../game/roles/foreign/recruit.ts';
import { canAfford } from '../../game/resources/bag.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { Army } from './Army.tsx';
import { Decks } from './Decks.tsx';
import { BattlePanel } from './BattlePanel.tsx';
import { RolePanel } from '../layout/RolePanel.tsx';
import { StashBar } from '../resources/StashBar.tsx';
import { TechCard } from '../cards/TechCard.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { nextSeatAfterDone } from '../layout/nextSeat.ts';
import { UnitCard } from '../cards/UnitCard.tsx';
import { UNITS } from '../../data/index.ts';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';

// Module-level lookup so the recruit hand can render the canonical
// UnitCard (which needs the full UnitDef) for a hand entry that only
// carries the unit's name.
const unitDefByName = new Map(UNITS.map((u) => [u.name, u]));

// Compact "5g" / "5g 2 steel" formatter for the recruit button label.
// Gold renders as "Ng" with no space; other resources render as "N <name>".
const formatCostBag = (bag: Partial<ResourceBag>): string => {
  const parts: string[] = [];
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = bag[r];
    if (v === undefined || v === 0) continue;
    parts.push(r === 'gold' ? `${v}g` : `${v} ${r}`);
  }
  return parts.length === 0 ? '0g' : parts.join(' ');
};

// "wood, steel" — comma-joined list of resources where stash falls short
// of the cost bag. Used in the "not enough resources" tooltip so the player
// can see which input is blocking the recruit.
const listShortfall = (
  stash: ResourceBag,
  cost: Partial<ResourceBag>,
): string => {
  const short: string[] = [];
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const need = cost[r] ?? 0;
    if (need > 0 && stash[r] < need) short.push(r);
  }
  return short.length === 0 ? '—' : short.join(', ');
};

export function ForeignPanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('foreign')) return null;

  const foreign = G.foreign;
  if (foreign === undefined) return null;

  const stage = ctx.activePlayers?.[playerID];
  const canActOnTurn = stage === 'foreignTurn';
  const canAssignDamage = stage === 'foreignAwaitingDamage';
  const battleInFlight = foreign.inFlight.battle !== null;
  const canFlipTrade = foreign.lastBattleOutcome === 'win';
  const upkeepPaid = foreign._upkeepPaid === true;
  // 14.13 — disable + relabel End-my-turn after the seat flips done.
  const alreadyDone = G.othersDone?.[playerID] === true;

  const upkeepDue = computeForeignUpkeepGold(G);
  const playerGold = G.mats?.[playerID]?.stash.gold ?? 0;
  const totalUnits = foreign.inPlay.reduce((sum, u) => sum + u.count, 0);
  const hasUnits = totalUnits > 0;
  // The seat-done gate cares about *upkeep-eligible* units, not raw inPlay —
  // units recruited this turn are exempt and don't block ending the turn.
  const hasUpkeepableUnits = upkeepableUnits(G).length > 0;

  // bgio's master rejects UNDO whenever multiple players are simultaneously
  // active via setActivePlayers, so we drive undo through the dedicated
  // `foreignUndoRelease` move and gate the button on the server-recorded
  // `_lastRelease` slot — present right after release, cleared by undo.
  const canUndo = foreign._lastRelease !== undefined && canActOnTurn;

  const upkeepTooltip = !canActOnTurn
    ? "Wait for the Foreign seat's turn"
    : upkeepPaid
      ? 'Upkeep already paid this round'
      : upkeepDue === 0
        ? hasUnits
          ? 'No upkeep due — units recruited this turn are exempt'
          : 'No upkeep due — recruit a unit first'
        : playerGold < upkeepDue
          ? `Not enough gold: owe ${upkeepDue}g, have ${playerGold}g (release a unit for a refund)`
          : '';

  const handleRecruit = (defID: string): void => {
    moves.foreignRecruit(defID, 1);
  };

  const handleRelease = (defID: string): void => {
    moves.foreignReleaseUnit(defID);
  };

  const handleUndo = (): void => {
    moves.foreignUndoRelease();
  };

  const handleFlipBattle = (): void => {
    moves.foreignFlipBattle();
  };

  const handleFlipTrade = (): void => {
    moves.foreignFlipTrade();
  };

  const handleUpkeep = (): void => {
    moves.foreignUpkeep();
  };

  const handleAssignDamage = (allocations: DamageAllocation[]): void => {
    moves.foreignAssignDamage(allocations);
  };

  const handleSeatDone = (): void => {
    moves.foreignSeatDone();
    if (seatCtx) seatCtx.setSeat(nextSeatAfterDone(G, playerID));
  };

  return (
    <RolePanel
      role="foreign"
      actions={
        <>
          <GraveyardButton
            role="foreign"
            entries={G.graveyards?.[playerID] ?? []}
          />
          <Tooltip
            title={upkeepTooltip}
            placement="top"
            disableHoverListener={upkeepTooltip === ''}
          >
            <Box component="span" sx={{ display: 'inline-flex' }}>
              <Button
                variant="contained"
                disabled={
                  !canActOnTurn ||
                  upkeepPaid ||
                  upkeepDue === 0 ||
                  playerGold < upkeepDue
                }
                onClick={handleUpkeep}
                aria-label="Pay upkeep"
                sx={{
                  bgcolor: (t) => t.palette.role.foreign.main,
                  color: (t) => t.palette.role.foreign.contrastText,
                  '&:hover': {
                    bgcolor: (t) => t.palette.role.foreign.dark,
                  },
                }}
              >
                {upkeepPaid
                  ? 'Upkeep paid'
                  : upkeepDue === 0
                    ? 'No upkeep due'
                    : `Pay Upkeep (${upkeepDue}g)`}
              </Button>
            </Box>
          </Tooltip>
          <Tooltip
            title={
              !alreadyDone && !upkeepPaid && hasUpkeepableUnits
                ? 'Pay upkeep or release all units before ending your turn'
                : ''
            }
            placement="top"
            disableHoverListener={
              alreadyDone || upkeepPaid || !hasUpkeepableUnits
            }
          >
            <Box component="span" sx={{ display: 'inline-flex' }}>
              <Button
                variant="contained"
                disabled={
                  (!canActOnTurn && !canAssignDamage) ||
                  alreadyDone ||
                  (!upkeepPaid && hasUpkeepableUnits)
                }
                onClick={handleSeatDone}
                aria-label="End my Foreign turn"
                sx={{
                  bgcolor: (t) => t.palette.role.foreign.main,
                  color: (t) => t.palette.role.foreign.contrastText,
                  '&:hover': {
                    bgcolor: (t) => t.palette.role.foreign.dark,
                  },
                }}
              >
                {alreadyDone ? 'Turn ended' : 'End my turn'}
              </Button>
            </Box>
          </Tooltip>
        </>
      }
    >
      <Stack spacing={1.5}>
        <StashBar
          stash={G.mats?.[playerID]?.stash}
          ariaLabel="Foreign stash"
        />

        <Stack
          direction="row"
          spacing={1}
          aria-label="Foreign hand"
          sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'flex-start' }}
        >
          {foreign.hand.length === 0 && (foreign.techHand ?? []).length === 0 ? (
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              No cards in hand.
            </Typography>
          ) : (
            <>
              {foreign.hand.map((unit) => {
                const def = unitDefByName.get(unit.name);
                const costBag = computeUnitRecruitCostBag(G, unit.name);
                const stash = G.mats?.[playerID]?.stash;
                const affordable =
                  stash !== undefined && canAfford(stash, costBag);
                const costLabel = formatCostBag(costBag);
                const shortfall = stash
                  ? listShortfall(stash, costBag)
                  : 'no stash';
                const tooltip = !canActOnTurn
                  ? "Wait for the Foreign seat's turn"
                  : !affordable
                    ? `Not enough resources: costs ${costLabel}, short on ${shortfall}`
                    : '';
                return (
                  <Tooltip
                    key={`unit-${unit.name}`}
                    title={tooltip}
                    placement="top"
                    disableHoverListener={tooltip === ''}
                  >
                    <Stack spacing={0.5} sx={{ alignItems: 'stretch' }}>
                      {def ? (
                        <UnitCard def={def} size="normal" />
                      ) : (
                        <Typography
                          variant="caption"
                          sx={{ color: (t) => t.palette.role.foreign.main, fontWeight: 700 }}
                        >
                          {unit.name}
                        </Typography>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!canActOnTurn || !affordable}
                        onClick={() => handleRecruit(unit.name)}
                        aria-label={`Recruit one ${unit.name}`}
                        sx={{
                          bgcolor: (t) => t.palette.role.foreign.main,
                          color: (t) => t.palette.role.foreign.contrastText,
                          '&:hover': {
                            bgcolor: (t) => t.palette.role.foreign.dark,
                          },
                        }}
                      >
                        Recruit
                      </Button>
                    </Stack>
                  </Tooltip>
                );
              })}
              {(foreign.techHand ?? []).map((tech) => {
                const stash = G.mats?.[playerID]?.stash;
                const costBag = tech.costBag ?? {};
                const costEntries = (Object.entries(costBag) as Array<[string, number]>)
                  .filter(([, v]) => (v ?? 0) > 0);
                const affordable =
                  costEntries.length === 0 ||
                  (stash !== undefined && canAfford(stash, costBag));
                const enabled = canActOnTurn && !alreadyDone && affordable;
                const costLabel =
                  costEntries.length === 0
                    ? 'free'
                    : costEntries.map(([r, v]) => `${v} ${r}`).join(', ');
                const tooltip = !canActOnTurn
                  ? "Wait for the Foreign seat's turn"
                  : !affordable
                    ? `Need ${costLabel}`
                    : '';
                return (
                  <Tooltip
                    key={`tech-${tech.name}`}
                    title={tooltip}
                    placement="top"
                    disableHoverListener={tooltip === ''}
                  >
                    <Stack spacing={0.5} sx={{ alignItems: 'stretch' }}>
                      <TechCard def={tech} holderRole="foreign" size="normal" />
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!enabled}
                        onClick={() => moves.foreignPlayTech(tech.name)}
                        aria-label={`Play ${tech.name}`}
                        sx={{
                          bgcolor: (t) => t.palette.role.foreign.main,
                          color: (t) => t.palette.role.foreign.contrastText,
                          '&:hover': {
                            bgcolor: (t) => t.palette.role.foreign.dark,
                          },
                        }}
                      >
                        Play
                      </Button>
                    </Stack>
                  </Tooltip>
                );
              })}
            </>
          )}
        </Stack>

        <Army
          inPlay={foreign.inPlay.map((u) => ({ ...u }))}
          canAct={canActOnTurn}
          onRelease={handleRelease}
          canUndo={canUndo}
          onUndo={handleUndo}
        />

        <Decks
          battleDeckCount={foreign.battleDeck.length}
          tradeDeckCount={foreign.tradeDeck.length}
          battleInFlight={battleInFlight}
          canFlipTrade={canFlipTrade}
          canAct={canActOnTurn}
          hasUnits={hasUnits}
          onFlipBattle={handleFlipBattle}
          onFlipTrade={handleFlipTrade}
        />

        <BattlePanel
          inFlight={foreign.inFlight}
          inPlay={foreign.inPlay.map((u) => ({ ...u }))}
          canAssignDamage={canAssignDamage}
          onAssignDamage={handleAssignDamage}
        />
      </Stack>
    </RolePanel>
  );
}

export default ForeignPanel;
