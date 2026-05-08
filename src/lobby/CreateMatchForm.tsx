// 11.7 — CreateMatchForm.
//
// Replaces the inline numPlayers picker + "Create Match" button in
// LobbyShell with a small form that adds a Solo toggle and a humanRole
// picker. When Solo is on, the form emits `soloMode: true` and the
// chosen `humanRole` so the server can spin per-seat bots from
// `src/lobby/soloConfig.ts` (the actual seat→isBot wiring lives in
// `server/bots/botDriver.ts:markSoloBotSeats`).
//
// Pure presentational MUI form — no LobbyClient calls here. The parent
// (LobbyShell) owns the REST round-trip and the post-create selection
// state.

import { useState } from 'react';
import {
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { Role } from '../game/types.ts';

export interface CreateMatchConfig {
  numPlayers: 1 | 2 | 3 | 4;
  /** When true, the match is a solo match — the server-side bot map
   * comes from `buildBotMap({ numPlayers, humanRole })`. */
  soloMode?: boolean;
  /** Required when `soloMode === true`; ignored otherwise. */
  humanRole?: Role;
}

export interface CreateMatchFormProps {
  onCreate: (cfg: CreateMatchConfig) => void;
  /** Initial number of seats in the picker. Defaults to 4 to match the
   * pre-11.7 LobbyShell behavior. */
  defaultNumPlayers?: 1 | 2 | 3 | 4;
}

const ROLES: Role[] = ['chief', 'science', 'domestic', 'defense'];

export function CreateMatchForm({
  onCreate,
  defaultNumPlayers = 4,
}: CreateMatchFormProps) {
  const [numPlayers, setNumPlayers] = useState<1 | 2 | 3 | 4>(defaultNumPlayers);
  const [soloMode, setSoloMode] = useState(false);
  const [humanRole, setHumanRole] = useState<Role>('chief');

  const submit = () => {
    if (soloMode) {
      onCreate({ numPlayers, soloMode: true, humanRole });
    } else {
      onCreate({ numPlayers });
    }
  };

  return (
    <Stack
      spacing={1}
      sx={{ alignItems: 'flex-start' }}
      aria-label="Create match form"
    >
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Set up a new match. The full game uses 4 seats — one per role
        (chief, science, domestic, defense). Lower seat counts pack
        multiple roles into one seat. Toggle <strong>Solo</strong> to
        play with bots filling every other seat — pick which role you
        want to control.
      </Typography>

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        <FormControl size="small" sx={{ minWidth: '6rem' }}>
          <InputLabel id="numPlayers-label">Players</InputLabel>
          <Select
            labelId="numPlayers-label"
            label="Players"
            value={numPlayers}
            onChange={(e) =>
              setNumPlayers(Number(e.target.value) as 1 | 2 | 3 | 4)
            }
            inputProps={{ 'aria-label': 'Number of players for new match' }}
          >
            {[1, 2, 3, 4].map((n) => (
              <MenuItem key={n} value={n}>
                {n}p
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={soloMode}
              onChange={(e) => setSoloMode(e.target.checked)}
              slotProps={{ input: { 'aria-label': 'Solo mode toggle' } }}
            />
          }
          label={
            <Typography variant="body2">Solo (vs.&nbsp;bots)</Typography>
          }
        />

        {soloMode ? (
          <FormControl size="small" sx={{ minWidth: '8rem' }}>
            <InputLabel id="humanRole-label">Your role</InputLabel>
            <Select
              labelId="humanRole-label"
              label="Your role"
              value={humanRole}
              onChange={(e) => setHumanRole(e.target.value as Role)}
              inputProps={{ 'aria-label': 'Human role for solo match' }}
            >
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        <Button variant="contained" onClick={submit}>
          Create Match
        </Button>
      </Stack>
    </Stack>
  );
}

export default CreateMatchForm;
