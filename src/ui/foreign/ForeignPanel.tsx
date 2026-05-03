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
import type { ReactNode } from 'react';
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
import { SectionHeading } from '../layout/SectionHeading.tsx';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { TechCard } from '../cards/TechCard.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { nextSeatAfterDone } from '../layout/nextSeat.ts';
import { UnitCard } from '../cards/UnitCard.tsx';
import { UNITS } from '../../data/index.ts';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';
import { UndoButton } from '../layout/UndoButton.tsx';
import { EmbossedFrame } from '../layout/EmbossedFrame.tsx';
import { RequestHelpButton } from '../requests/RequestHelpButton.tsx';
import { RequestsRow } from '../requests/RequestsRow.tsx';
import { WanderEffectRow } from '../opponent/WanderEffectRow.tsx';
import { buildResourceSlices } from '../requests/useResourceSlice.ts';
import { idForUnit, idForTech } from '../../cards/registry.ts';

// Module-level lookup so the recruit hand can render the canonical
// UnitCard (which needs the full UnitDef) for a hand entry that only
// carries the unit's name.
const unitDefByName = new Map(UNITS.map((u) => [u.name, u]));

// Render a recruit cost bag as a row of `ResourceToken` icons (each with
// the resource name on hover) so the tooltip never spells out a resource
// name as text. Returns "0" when the bag is empty (free unit).
const renderCostIcons = (bag: Partial<ResourceBag>): ReactNode => {
  const entries: Array<[Resource, number]> = [];
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = bag[r];
    if (v === undefined || v === 0) continue;
    entries.push([r, v]);
  }
  if (entries.length === 0) return '0';
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
    >
      {entries.map(([r, v]) => (
        <ResourceToken key={r} resource={r} count={v} size="small" />
      ))}
    </Box>
  );
};

// Render the resources where stash falls short of the cost as a row of
// icon-only `ResourceToken`s (no count). Used in the "not enough
// resources" tooltip so the blocking inputs are still icons rather than
// names.
const renderShortfallIcons = (
  stash: ResourceBag,
  cost: Partial<ResourceBag>,
): ReactNode => {
  const short: Resource[] = [];
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const need = cost[r] ?? 0;
    if (need > 0 && stash[r] < need) short.push(r);
  }
  if (short.length === 0) return '—';
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
    >
      {short.map((r) => (
        <ResourceToken key={r} resource={r} size="small" />
      ))}
    </Box>
  );
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


  const upkeepTooltip: ReactNode = !canActOnTurn
    ? "Wait for the Foreign seat's turn"
    : upkeepPaid
      ? 'Upkeep already paid this round'
      : upkeepDue === 0
        ? hasUnits
          ? 'No upkeep due — units recruited this turn are exempt'
          : 'No upkeep due — recruit a unit first'
        : playerGold < upkeepDue
          ? (
              <Box
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, flexWrap: 'wrap' }}
              >
                Not enough{' '}
                <ResourceToken resource="gold" size="small" />: owe{' '}
                <ResourceToken resource="gold" count={upkeepDue} size="small" />, have{' '}
                <ResourceToken resource="gold" count={playerGold} size="small" /> (release a unit for a refund)
              </Box>
            )
          : '';

  const handleRecruit = (defID: string): void => {
    moves.foreignRecruit(defID, 1);
  };

  const handleRelease = (defID: string): void => {
    moves.foreignReleaseUnit(defID);
  };

  const handleUndo = (): void => {
    moves.undoLast();
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
      connectedAbove
      topRow={<WanderEffectRow opponent={G.opponent} />}
      actions={
        <>
          <GraveyardButton
            role="foreign"
            entries={G.graveyards?.[playerID] ?? []}
          />
          <UndoButton
            G={G}
            playerID={playerID}
            canAct={canActOnTurn && !alreadyDone}
            onUndo={handleUndo}
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
                {upkeepPaid ? (
                  'Upkeep paid'
                ) : upkeepDue === 0 ? (
                  'No upkeep due'
                ) : (
                  <Box
                    component="span"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
                  >
                    Pay Upkeep
                    <ResourceToken resource="gold" count={upkeepDue} size="small" />
                  </Box>
                )}
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
        <RequestsRow G={G} playerID={playerID} panelRole="foreign" />

        <SectionHeading role="foreign">Cards</SectionHeading>
        <Stack
          direction="row"
          spacing={1}
          aria-label="Foreign hand"
          sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'flex-start' }}
        >
          {foreign.hand.length === 0 && (foreign.techHand ?? []).length === 0 ? (
            <EmbossedFrame
              role="foreign"
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.muted,
                  fontStyle: 'italic',
                  py: 2,
                }}
              >
                No cards in hand.
              </Typography>
            </EmbossedFrame>
          ) : (
            <>
              {foreign.hand.map((unit) => {
                const def = unitDefByName.get(unit.name);
                const costBag = computeUnitRecruitCostBag(G, unit.name);
                const stash = G.mats?.[playerID]?.stash;
                const affordable =
                  stash !== undefined && canAfford(stash, costBag);
                const tooltip: ReactNode = !canActOnTurn
                  ? "Wait for the Foreign seat's turn"
                  : !affordable
                    ? (
                        <Box
                          component="span"
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, flexWrap: 'wrap' }}
                        >
                          Not enough resources: costs {renderCostIcons(costBag)}
                          {stash ? (
                            <>
                              , short on {renderShortfallIcons(stash, costBag)}
                            </>
                          ) : (
                            ', no stash'
                          )}
                        </Box>
                      )
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
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Box sx={{ flex: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            fullWidth
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
                        </Box>
                        {def ? (
                          <RequestHelpButton
                            G={G}
                            playerID={playerID}
                            moves={moves}
                            fromRole="foreign"
                            targetId={idForUnit(def)}
                            targetLabel={def.name}
                            slices={buildResourceSlices({
                              G,
                              fromSeat: playerID,
                              fromRole: 'foreign',
                              cost: costBag,
                              have: stash,
                            })}
                          />
                        ) : null}
                      </Stack>
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
                const tooltip: ReactNode = !canActOnTurn
                  ? "Wait for the Foreign seat's turn"
                  : !affordable
                    ? (
                        <Box
                          component="span"
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, flexWrap: 'wrap' }}
                        >
                          Need {renderCostIcons(costBag)}
                        </Box>
                      )
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
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Box sx={{ flex: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            fullWidth
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
                        </Box>
                        <RequestHelpButton
                          G={G}
                          playerID={playerID}
                          moves={moves}
                          fromRole="foreign"
                          targetId={idForTech(tech)}
                          targetLabel={tech.name}
                          slices={buildResourceSlices({
                            G,
                            fromSeat: playerID,
                            fromRole: 'foreign',
                            cost: costBag,
                            have: stash,
                          })}
                        />
                      </Stack>
                    </Stack>
                  </Tooltip>
                );
              })}
            </>
          )}
        </Stack>

        <SectionHeading role="foreign">Army</SectionHeading>
        <Army
          inPlay={foreign.inPlay.map((u) => ({ ...u }))}
          canAct={canActOnTurn}
          onRelease={handleRelease}
        />

        <SectionHeading role="foreign">Excursions</SectionHeading>
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
