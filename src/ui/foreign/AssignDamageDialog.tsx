// AssignDamageDialog (14.10) — real per-round absorber UI.
//
// The 07.3 resolver consumes one `DamageAllocation` per enemy → player
// damage event in resolver order. We discover the per-event count via
// `discoverIncomingEvents` (allocator.ts), which iteratively runs the
// resolver with greedy fills until it stops complaining about a
// missing allocation at the next index.
//
// For each event we render an "Incoming N damage" strip with one
// per-defID stepper. The submit button enables only when every
// strip's running sum equals its incoming amount; on submit we hand
// the array to the parent's `onSubmit`. The resolver still owns
// validation (lethal-or-leftover rule, etc.) — if the move INVALID_MOVEs,
// the dialog stays open via `foreignAwaitingDamage` so the player can
// retry.
//
// Greedy default: pre-fills each strip with "lowest-HP defID absorbs
// first, partial leftover on the highest-HP defID". One click submits
// a sane plan.

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type {
  DamageAllocation,
  EnemyDamageRule,
} from '../../game/roles/foreign/battleResolver.ts';
import type {
  BattleInFlight,
  UnitInstance,
} from '../../game/roles/foreign/types.ts';
import {
  discoverIncomingEvents,
  greedyAllocation,
  playerRowsFor,
  sumAllocation,
  type IncomingEvent,
  type PlayerRow,
} from './allocator.ts';

export interface AssignDamageDialogProps {
  open: boolean;
  inPlay: UnitInstance[];
  /** The in-flight battle. We need the enemy units and the battle's
   *  damageRule to drive the resolver preview. */
  inFlight: BattleInFlight;
  onSubmit: (allocations: DamageAllocation[]) => void;
  onCancel: () => void;
}

// V1: matches `assignDamage.ts` — every current battle uses
// 'attacksWeakest'. When a card adds a per-card override later, lift
// the value off the BattleCardDef instead of this constant.
const ENEMY_DAMAGE_RULE: EnemyDamageRule = 'attacksWeakest';

/** Build the (defID -> 0) shape so the stepper UI knows which rows to
 *  render even when the greedy default put no damage on a defID. */
const zeroAllocFromRows = (rows: ReadonlyArray<PlayerRow>): DamageAllocation => {
  const byUnit: Record<string, number> = {};
  for (const r of rows) byUnit[r.defID] = 0;
  return { byUnit };
};

const mergeWithRowKeys = (
  rows: ReadonlyArray<PlayerRow>,
  base: DamageAllocation,
): DamageAllocation => {
  const byUnit: Record<string, number> = {};
  for (const r of rows) byUnit[r.defID] = base.byUnit[r.defID] ?? 0;
  return { byUnit };
};

export function AssignDamageDialog({
  open,
  inPlay,
  inFlight,
  onSubmit,
  onCancel,
}: AssignDamageDialogProps) {
  const enemyRule: EnemyDamageRule = ENEMY_DAMAGE_RULE;

  const enemyUnits: UnitInstance[] = useMemo(() => {
    const card = inFlight.battle;
    if (!card) return [];
    return card.units.map((u) => ({
      defID: u.name,
      count: u.count ?? 1,
    }));
  }, [inFlight.battle]);

  const events: IncomingEvent[] = useMemo(() => {
    if (!open || !inFlight.battle) return [];
    return discoverIncomingEvents({
      player: inPlay,
      enemy: enemyUnits,
      enemyDamageRule: enemyRule,
    });
  }, [open, inFlight.battle, inPlay, enemyUnits, enemyRule]);

  const playerRows = useMemo(() => playerRowsFor(inPlay), [inPlay]);

  // One DamageAllocation per event; user-editable. Reset whenever the
  // event list changes (i.e. the dialog opens for a new battle).
  const [allocations, setAllocations] = useState<DamageAllocation[]>([]);

  useEffect(() => {
    setAllocations(
      events.map((e) =>
        mergeWithRowKeys(
          playerRows,
          e.defaultAllocation ?? zeroAllocFromRows(playerRows),
        ),
      ),
    );
  }, [events, playerRows]);

  if (!open) return null;

  const setEntry = (
    eventIdx: number,
    defID: string,
    value: number,
  ): void => {
    setAllocations((prev) => {
      const next = prev.map((a, i) =>
        i === eventIdx
          ? { byUnit: { ...a.byUnit, [defID]: Math.max(0, Math.floor(value)) } }
          : a,
      );
      return next;
    });
  };

  const adjust = (
    eventIdx: number,
    defID: string,
    delta: number,
    cap: number,
  ): void => {
    const current = allocations[eventIdx]?.byUnit[defID] ?? 0;
    const next = Math.max(0, Math.min(cap, current + delta));
    setEntry(eventIdx, defID, next);
  };

  const resetEvent = (eventIdx: number): void => {
    const greedy = greedyAllocation(playerRows, events[eventIdx]!.incoming);
    setAllocations((prev) =>
      prev.map((a, i) =>
        i === eventIdx
          ? mergeWithRowKeys(
              playerRows,
              greedy ?? zeroAllocFromRows(playerRows),
            )
          : a,
      ),
    );
  };

  const allSumsMatch = events.every(
    (e, i) => sumAllocation(allocations[i] ?? { byUnit: {} }) === e.incoming,
  );
  const submittable = events.length > 0 && allSumsMatch;

  // No incoming events at all: the battle is decided without the player
  // taking damage. Still surface a "Resolve" button so the player can
  // submit `[]`, which the resolver accepts.
  if (events.length === 0) {
    return (
      <Box role="dialog" aria-label="Assign damage" sx={{ mt: 1 }}>
        <Paper
          elevation={0}
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
              sx={{
                color: (t) => t.palette.role.foreign.main,
                fontWeight: 600,
              }}
            >
              No incoming damage
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              The resolver predicts no enemy → player damage events.
              Submit an empty allocation to resolve the battle.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="contained"
                onClick={() => onSubmit([])}
                aria-label="Resolve battle with empty allocation"
                sx={{
                  bgcolor: (t) => t.palette.role.foreign.main,
                  color: (t) => t.palette.role.foreign.contrastText,
                  '&:hover': {
                    bgcolor: (t) => t.palette.role.foreign.dark,
                  },
                }}
              >
                Resolve
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={onCancel}
                aria-label="Cancel damage assignment"
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box role="dialog" aria-label="Assign damage" sx={{ mt: 1 }}>
      <Paper
        elevation={0}
        sx={{
          px: 1.5,
          py: 1,
          border: '1px solid',
          borderColor: (t) => t.palette.role.foreign.main,
          bgcolor: (t) => t.palette.card.surface,
        }}
      >
        <Stack spacing={1}>
          <Typography
            variant="body2"
            sx={{ color: (t) => t.palette.role.foreign.main, fontWeight: 700 }}
          >
            Assign damage ({events.length}{' '}
            {events.length === 1 ? 'event' : 'events'})
          </Typography>

          {events.map((event, eventIdx) => {
            const alloc =
              allocations[eventIdx] ??
              mergeWithRowKeys(playerRows, zeroAllocFromRows(playerRows));
            const sum = sumAllocation(alloc);
            const matches = sum === event.incoming;
            return (
              <Box
                key={eventIdx}
                aria-label={`Incoming damage event ${eventIdx + 1}`}
                sx={{
                  border: '1px dashed',
                  borderColor: (t) =>
                    matches
                      ? t.palette.role.foreign.main
                      : t.palette.status.muted,
                  borderRadius: 0.5,
                  px: 1,
                  py: 0.75,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: (t) =>
                        matches
                          ? t.palette.role.foreign.main
                          : t.palette.status.muted,
                      fontWeight: 700,
                    }}
                  >
                    Incoming {event.incoming} damage — {sum}/{event.incoming}{' '}
                    absorbed
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => resetEvent(eventIdx)}
                    aria-label={`Reset event ${eventIdx + 1} to greedy default`}
                  >
                    Reset
                  </Button>
                </Stack>

                {playerRows.length === 0 ? (
                  <Typography
                    variant="caption"
                    sx={{ color: (t) => t.palette.status.muted }}
                  >
                    No units in play to absorb damage.
                  </Typography>
                ) : (
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {playerRows.map((row) => {
                      const absorbed = alloc.byUnit[row.defID] ?? 0;
                      return (
                        <Stack
                          key={row.defID}
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'center' }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ minWidth: '8rem', fontWeight: 600 }}
                          >
                            {row.defID} ×{row.count}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: (t) => t.palette.status.muted,
                              minWidth: '5rem',
                            }}
                          >
                            ({row.totalHp} HP)
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label={`Decrement ${row.defID} absorption for event ${
                              eventIdx + 1
                            }`}
                            disabled={absorbed === 0}
                            onClick={() =>
                              adjust(eventIdx, row.defID, -1, row.totalHp)
                            }
                          >
                            −
                          </IconButton>
                          <Typography
                            variant="caption"
                            sx={{
                              minWidth: '1.5rem',
                              textAlign: 'center',
                              fontWeight: 700,
                            }}
                          >
                            {absorbed}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label={`Increment ${row.defID} absorption for event ${
                              eventIdx + 1
                            }`}
                            disabled={absorbed >= row.totalHp}
                            onClick={() =>
                              adjust(eventIdx, row.defID, +1, row.totalHp)
                            }
                          >
                            +
                          </IconButton>
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            );
          })}

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              disabled={!submittable}
              onClick={() => onSubmit(allocations)}
              aria-label="Submit damage allocations"
              sx={{
                bgcolor: (t) => t.palette.role.foreign.main,
                color: (t) => t.palette.role.foreign.contrastText,
                '&:hover': {
                  bgcolor: (t) => t.palette.role.foreign.dark,
                },
              }}
            >
              Submit
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onCancel}
              aria-label="Cancel damage assignment"
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default AssignDamageDialog;
