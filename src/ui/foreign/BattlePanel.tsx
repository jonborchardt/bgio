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
  const reward = rewardEntries(battle.reward);

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
      <Stack spacing={0.75}>
        <Typography
          variant="body2"
          sx={{ color: (t) => t.palette.role.foreign.main, fontWeight: 700 }}
        >
          Battle: {battle.id} (#{battle.number})
        </Typography>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
          {battle.units.map((u, i) => (
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
          ))}
        </Stack>

        {reward.length > 0 ? (
          <Stack
            direction="row"
            spacing={1}
            aria-label="Battle reward"
            sx={{ alignItems: 'center' }}
          >
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              Reward:
            </Typography>
            {reward.map(({ resource, amount }) => (
              <Stack
                key={resource}
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center' }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    bgcolor: (t) => t.palette.resource[resource].main,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: (t) => t.palette.resource[resource].main,
                    fontWeight: 600,
                  }}
                >
                  {amount}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}

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
          onSubmit={handleSubmit}
          onCancel={() => setDialogOpen(false)}
        />
      </Stack>
    </Paper>
  );
}

export default BattlePanel;
