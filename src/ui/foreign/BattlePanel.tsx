// BattlePanel (07.7) — visible only when a battle is in flight.
//
// Shows the flipped battle card's enemy units + reward, plus an
// "Assign Damage" button that opens the AssignDamageDialog stub. The
// resolver-preview pass (re-running resolveBattle to show a live outcome)
// is deferred to a follow-up — V1 just hands the allocations through
// unmodified.

import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { BattleInFlight } from '../../game/roles/foreign/types.ts';
import type { UnitInstance } from '../../game/roles/foreign/types.ts';
import type { DamageAllocation } from '../../game/roles/foreign/battleResolver.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { AssignDamageDialog } from './AssignDamageDialog.tsx';
import { BattleCard } from '../cards/BattleCard.tsx';
import { UnitCard } from '../cards/UnitCard.tsx';
import { UNITS } from '../../data/index.ts';
import { BATTLE_CARDS } from '../../data/battleCards.ts';

const battleDefById = new Map(BATTLE_CARDS.map((b) => [b.id, b]));
const unitDefByName = new Map(UNITS.map((u) => [u.name, u]));

export interface BattlePanelProps {
  inFlight: BattleInFlight;
  inPlay: UnitInstance[];
  canAssignDamage: boolean;
  onAssignDamage: (allocations: DamageAllocation[]) => void;
}

const rewardEntries = (
  reward: Partial<ResourceBag> | undefined,
): { resource: Resource; amount: number }[] => {
  const out: { resource: Resource; amount: number }[] = [];
  if (reward === undefined) return out;
  for (const r of RESOURCES) {
    const v = reward[r];
    if (v !== undefined && v > 0) out.push({ resource: r, amount: v });
  }
  return out;
};

export function BattlePanel({
  inFlight,
  inPlay,
  canAssignDamage,
  onAssignDamage,
}: BattlePanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (inFlight.battle === null) return null;

  const { battle } = inFlight;
  // rewardEntries kept for the legacy chip path when the battle has no
  // matching BattleCardDef (older fixtures), but the canonical
  // BattleCard already shows reward + tribute, so we only fall back
  // when the def can't be resolved.
  void rewardEntries;
  const battleDef = battleDefById.get(battle.id);

  const handleSubmit = (allocations: DamageAllocation[]): void => {
    setDialogOpen(false);
    onAssignDamage(allocations);
  };

  return (
    <Paper
      elevation={0}
      aria-label="In-flight battle"
      sx={{
        px: 1.5,
        py: 1,
        border: '1px solid',
        borderColor: (t) => t.palette.role.foreign.main,
        bgcolor: (t) => t.palette.card.surface,
      }}
    >
      <Stack spacing={1}>
        {battleDef ? (
          <BattleCard def={battleDef} size="normal" />
        ) : (
          <Typography
            variant="body2"
            sx={{ color: (t) => t.palette.role.foreign.main, fontWeight: 700 }}
          >
            Battle: {battle.id} (#{battle.number})
          </Typography>
        )}

        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
        >
          Enemy units
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {battle.units.map((u, i) => {
            const def = unitDefByName.get(u.name);
            if (!def) {
              return (
                <Typography
                  key={`${u.name}-${i}`}
                  variant="caption"
                  sx={{
                    color: (t) => t.palette.role.foreign.main,
                    fontWeight: 600,
                  }}
                >
                  {u.name}
                  {u.count !== undefined && u.count > 1 ? ` ×${u.count}` : ''}
                </Typography>
              );
            }
            return (
              <UnitCard
                key={`${u.name}-${i}`}
                def={def}
                count={u.count}
                size="normal"
              />
            );
          })}
        </Stack>

        <Box>
          <Button
            size="small"
            variant="contained"
            disabled={!canAssignDamage}
            onClick={() => setDialogOpen(true)}
            aria-label="Open assign damage dialog"
            sx={{
              bgcolor: (t) => t.palette.role.foreign.main,
              color: (t) => t.palette.role.foreign.contrastText,
              '&:hover': {
                bgcolor: (t) => t.palette.role.foreign.dark,
              },
            }}
          >
            Assign Damage
          </Button>
        </Box>

        <AssignDamageDialog
          open={dialogOpen}
          inPlay={inPlay}
          inFlight={inFlight}
          onSubmit={handleSubmit}
          onCancel={() => setDialogOpen(false)}
        />
      </Stack>
    </Paper>
  );
}

export default BattlePanel;
