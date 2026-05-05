// Defense redesign 3.7 — TeachDialog.
//
// Modal flow for the science seat's `scienceTeach` move:
//
//   1. SciencePanel renders a "Teach a skill" trigger button (this
//      file's `TeachButton` export).
//   2. Clicking opens the dialog. The dialog shows two pickers:
//        - SKILLS list (with cost + description), and
//        - placed units (filtered by "unit hasn't already learned the
//          chosen skill").
//   3. The player picks a skill, then a unit. Confirm dispatches
//      `scienceTeach(unitID, skillID)` and closes the dialog.
//
// Affordability and the per-skill "unit already taught" check are
// surfaced inline — the underlying move would still INVALID_MOVE, but
// the UI explains *why* the row is disabled rather than letting the
// player click into a silent rejection.

import { useState } from 'react';
import {
  Box,
  Button,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import {
  SKILLS,
  SKILL_IDS,
  type SkillID,
} from '../../game/roles/science/skills.ts';
import { UnitPickerDialog } from './UnitPicker.tsx';
import {
  teachDisabledReason,
  teachUnitDisabledReason,
} from './drillTeachLogic.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';

export interface TeachButtonProps {
  units: ReadonlyArray<UnitInstance>;
  canAct: boolean;
  taughtUsed: boolean;
  stashScience: number;
  onTeach: (unitID: string, skillID: SkillID) => void;
}

export function TeachButton({
  units,
  canAct,
  taughtUsed,
  stashScience,
  onTeach,
}: TeachButtonProps) {
  const [open, setOpen] = useState(false);
  const [chosenSkill, setChosenSkill] = useState<SkillID | null>(null);

  const reason = teachDisabledReason({
    canAct,
    taughtUsed,
    stashScience,
    units,
  });
  const disabled = reason !== null;

  const status = taughtUsed ? 'used this round' : 'available';

  const close = (): void => {
    setOpen(false);
    setChosenSkill(null);
  };

  const handlePickUnit = (unitID: string): void => {
    if (chosenSkill === null) return;
    onTeach(unitID, chosenSkill);
    close();
  };

  const skill = chosenSkill !== null ? SKILLS[chosenSkill] : null;

  return (
    <Stack spacing={0.5} data-teach-control="true">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Tooltip title={reason ?? ''} disableHoverListener={!disabled}>
          <Box component="span" sx={{ display: 'inline-flex' }}>
            <Button
              variant="contained"
              disabled={disabled}
              onClick={() => setOpen(true)}
              aria-label="Teach a skill to a unit"
              data-teach-button="true"
              data-teach-disabled={disabled ? 'true' : 'false'}
              sx={{
                bgcolor: (t) => t.palette.role.science.main,
                color: (t) => t.palette.role.science.contrastText,
                '&:hover': {
                  bgcolor: (t) => t.palette.role.science.dark,
                },
              }}
            >
              Teach a skill
            </Button>
          </Box>
        </Tooltip>
        <Typography
          variant="caption"
          data-teach-status={taughtUsed ? 'used' : 'available'}
          sx={{
            color: (t) =>
              taughtUsed ? t.palette.status.muted : t.palette.role.science.light,
          }}
        >
          Teach: {status}
        </Typography>
      </Stack>

      <UnitPickerDialog
        open={open}
        onClose={close}
        title={skill === null ? 'Choose a skill' : `Teach ${skill.name}`}
        header={
          skill === null ? (
            <Stack spacing={0.75} data-teach-skill-list="true">
              <Typography
                variant="body2"
                sx={{ color: (t) => t.palette.status.muted }}
              >
                Pick a skill to teach. Cost is paid from your stash.
              </Typography>
              {SKILL_IDS.map((id) => {
                const def = SKILLS[id];
                const affordable = stashScience >= def.cost;
                return (
                  <Tooltip
                    key={id}
                    // aria-label still spells the cost out for screen
                    // readers (the token's text alternative is the
                    // count + name, but a hover-tooltip bridges it
                    // explicitly when the player can't afford it).
                    title={
                      affordable
                        ? ''
                        : `Need ${def.cost} science (have ${stashScience}).`
                    }
                    disableHoverListener={affordable}
                  >
                    <Box component="span" sx={{ display: 'inline-flex' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={!affordable}
                        onClick={() => setChosenSkill(id)}
                        data-teach-skill-id={id}
                        data-teach-skill-affordable={affordable ? 'true' : 'false'}
                        aria-label={`Choose skill ${def.name} (cost ${def.cost} science)`}
                        sx={{
                          textAlign: 'left',
                          textTransform: 'none',
                          justifyContent: 'flex-start',
                          alignItems: 'flex-start',
                          flexDirection: 'column',
                          width: '100%',
                          borderColor: (t) => t.palette.role.science.dark,
                          color: (t) => t.palette.role.science.contrastText,
                          '&:hover:not(:disabled)': {
                            borderColor: (t) => t.palette.role.science.main,
                            bgcolor: (t) => t.palette.role.science.dark,
                          },
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontWeight: 700,
                          }}
                        >
                          {def.name}
                          <Box
                            component="span"
                            aria-hidden
                            sx={{ mx: 0.25, color: (t) => t.palette.status.muted }}
                          >
                            —
                          </Box>
                          <ResourceToken
                            resource="science"
                            count={def.cost}
                            size="small"
                          />
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            fontSize: '0.75rem',
                            color: (t) => t.palette.status.muted,
                            display: 'block',
                          }}
                        >
                          {def.description}
                        </Box>
                      </Button>
                    </Box>
                  </Tooltip>
                );
              })}
            </Stack>
          ) : (
            <Stack spacing={0.5} data-teach-confirm-header="true">
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {skill.name}
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  aria-hidden
                  sx={{ color: (t) => t.palette.status.muted }}
                >
                  —
                </Typography>
                <ResourceToken
                  resource="science"
                  count={skill.cost}
                  size="small"
                />
              </Box>
              <Typography
                variant="body2"
                sx={{ color: (t) => t.palette.status.muted }}
              >
                {skill.description}
              </Typography>
              <Box
                data-teach-affordability={
                  stashScience >= skill.cost ? 'ok' : 'short'
                }
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: (t) =>
                    stashScience >= skill.cost
                      ? t.palette.status.healthy
                      : t.palette.status.warning,
                }}
              >
                <Typography variant="caption">You have</Typography>
                <ResourceToken
                  resource="science"
                  count={stashScience}
                  size="small"
                />
                <Typography variant="caption">
                  {stashScience >= skill.cost
                    ? '— enough.'
                    : `— need ${skill.cost}.`}
                </Typography>
              </Box>
            </Stack>
          )
        }
        footer={
          skill === null ? null : (
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="text"
                onClick={() => setChosenSkill(null)}
                aria-label="Choose a different skill"
              >
                ← Back to skills
              </Button>
            </Stack>
          )
        }
        units={skill === null ? [] : units}
        emptyHint={
          skill === null
            ? 'Pick a skill above to see eligible units.'
            : 'No units on the village grid yet.'
        }
        disabled={
          skill === null
            ? () => 'Pick a skill above first.'
            : (unit) => teachUnitDisabledReason(unit, skill, stashScience)
        }
        onPick={handlePickUnit}
      />
    </Stack>
  );
}

export default TeachButton;
