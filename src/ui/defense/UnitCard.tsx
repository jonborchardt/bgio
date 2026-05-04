// Defense redesign 3.6 — defense-panel UnitCard.
//
// Wraps the canonical `cards/UnitCard` (which renders the V9 shell view
// of a UnitDef) with the per-card chrome the Defense seat needs while
// the unit is sitting in hand: the buy + place trigger, an affordability
// hint, and a selection outline so the player can see which card has
// "armed" the placement overlay.
//
// Selection model: clicking the action button toggles selection. When
// selected, the parent (DefensePanel) hands the matching cellKey to the
// `defenseBuyAndPlace(unitDefID, cellKey)` move. Re-clicking the same
// card cancels selection (matches the Domestic-Hand "Cancel" pattern).
//
// All visual choices route through theme tokens; no raw hex literals.

import type { ReactNode } from 'react';
import { Box, Button, Stack, Tooltip } from '@mui/material';
import type { UnitDef } from '../../data/schema.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import { canAfford } from '../../game/resources/bag.ts';
import { unitCost } from '../../data/index.ts';
import { UnitCard as CanonicalUnitCard } from '../cards/UnitCard.tsx';
import { ResourceToken } from '../resources/ResourceToken.tsx';

export interface UnitCardProps {
  def: UnitDef;
  /** Seat's stash bag — drives the "can the seat afford this?" gate. */
  stash?: ResourceBag;
  /** True when the seat is in `defenseTurn` and hasn't ended their turn. */
  canAct: boolean;
  /** Currently-selected unit name in the parent panel, if any. */
  selectedName?: string;
  /** Toggle selection. The parent inverts on second click. */
  onSelect: (unitDefID: string) => void;
}

const costEntries = (
  bag: Partial<ResourceBag>,
): Array<{ resource: Resource; amount: number }> => {
  const out: Array<{ resource: Resource; amount: number }> = [];
  for (const r of RESOURCES) {
    const v = bag[r] ?? 0;
    if (v > 0) out.push({ resource: r, amount: v });
  }
  return out;
};

const renderCost = (
  entries: ReadonlyArray<{ resource: Resource; amount: number }>,
): ReactNode =>
  entries.length === 0 ? (
    'free'
  ) : (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.4,
        verticalAlign: 'middle',
      }}
    >
      {entries.map((e) => (
        <ResourceToken
          key={e.resource}
          resource={e.resource}
          count={e.amount}
          size="small"
        />
      ))}
    </Box>
  );

export function UnitCard({
  def,
  stash,
  canAct,
  selectedName,
  onSelect,
}: UnitCardProps) {
  const isSelected = def.name === selectedName;
  const cost = unitCost(def);
  const entries = costEntries(cost);
  const affordable = stash ? canAfford(stash, cost) : false;
  const enabled = canAct && affordable;

  const tooltipNodes: ReactNode[] = [];
  if (def.note) tooltipNodes.push(<span key="note">{def.note}</span>);
  if (!affordable) {
    tooltipNodes.push(
      <Box
        key="need"
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
      >
        Need {renderCost(entries)}
      </Box>,
    );
  }
  if (!canAct) tooltipNodes.push(<span key="turn">Not your turn.</span>);
  const tooltip: ReactNode =
    tooltipNodes.length === 0 ? (
      ''
    ) : (
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        {tooltipNodes.map((node, i) => (
          <Box
            key={i}
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {i > 0 ? (
              <Box component="span" sx={{ mx: 0.5 }}>
                —
              </Box>
            ) : null}
            {node}
          </Box>
        ))}
      </Stack>
    );

  return (
    <Tooltip
      title={tooltip}
      placement="top"
      disableHoverListener={tooltipNodes.length === 0}
    >
      <Stack
        spacing={0.5}
        data-defense-unit-card="true"
        data-unit-def={def.name}
        data-unit-selected={isSelected ? 'true' : 'false'}
        sx={{
          alignItems: 'stretch',
          outline: isSelected ? '2px solid' : 'none',
          outlineColor: (t) => t.palette.role.defense.light,
          borderRadius: 1.5,
        }}
      >
        <CanonicalUnitCard def={def} size="normal" />
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center' }}
        >
          <Box sx={{ flex: 1 }}>
            <Button
              size="small"
              variant="contained"
              fullWidth
              disabled={!enabled && !isSelected}
              onClick={() => onSelect(def.name)}
              aria-pressed={isSelected}
              aria-label={
                isSelected
                  ? `Cancel selection of ${def.name}`
                  : `Select ${def.name} to place`
              }
              data-defense-unit-action="true"
              sx={{
                bgcolor: (t) => t.palette.role.defense.main,
                color: (t) => t.palette.role.defense.contrastText,
                '&:hover': {
                  bgcolor: (t) => t.palette.role.defense.dark,
                },
              }}
            >
              {isSelected ? 'Cancel' : 'Buy & place'}
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Tooltip>
  );
}

export default UnitCard;
