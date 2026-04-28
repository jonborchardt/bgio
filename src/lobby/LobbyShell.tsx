// LobbyShell (10.3) — minimal MUI lobby UI built on top of bgio's
// `LobbyClient`. Lists matches, exposes a "Create Match" button, and
// uses `<SeatPicker>` to pick a seat in the highlighted match.
//
// **Deviation from 10.3 plan:** the plan suggests rendering bgio's stock
// `<Lobby>` React component with a custom `renderer` prop. In practice
// bgio's `<Lobby>` is tightly coupled to its internal `gameComponents`
// flow + auth state machine and expects to fully own the page (login →
// list → room → in-game switching, including mounting the game Client
// itself). For our V1 lobby — which only needs match list / create /
// join / hand-off — wiring all that surface back onto our App.tsx
// custom mount path is more glue than we save by getting the stock UI
// for free. The plan explicitly allows this: "we only build UI on top
// of LobbyClient". So this component talks to `lobby` (the
// `LobbyClient` singleton) directly for REST and renders our own MUI.
// All REST calls remain via `LobbyClient` — no hand-rolled fetch
// wrappers around the bgio endpoints.

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { lobby } from './lobbyClient.ts';
import { SeatPicker } from './SeatPicker.tsx';
import { AuthForms } from './AuthForms.tsx';

/** localStorage key for the persisted auth token + minimal user blob.
 * 10.7 puts the token in its own slot rather than co-mingling with the
 * `settlement.session` (10.6) key. */
const AUTH_STORAGE_KEY = 'settlement.auth';

interface AuthState {
  token: string;
  user: { id: string; username: string };
}

const loadAuth = (): AuthState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthState> | null;
    if (
      !parsed ||
      typeof parsed.token !== 'string' ||
      !parsed.user ||
      typeof parsed.user.id !== 'string' ||
      typeof parsed.user.username !== 'string'
    ) {
      return null;
    }
    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
};

const saveAuth = (state: AuthState): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / storage errors are non-fatal; the user can re-login.
  }
};

/** Per-match summary used for the lobby list. We narrow bgio's
 * `LobbyAPI.Match` to the fields we actually render. */
interface LobbyMatch {
  matchID: string;
  players: Array<{ id: number; name?: string }>;
}

export interface LobbyShellProps {
  /** Fired once the player has joined a match. Parent uses these to
   * mount the networked game `Client` (App.tsx) and persist creds (10.6).
   * For spectator joins, `playerID` and `credentials` are both `null`
   * (no seat, no per-seat token). */
  onSelect: (
    matchID: string,
    playerID: string | null,
    credentials: string | null,
  ) => void;
  /** Default playerName the join call sends to bgio. Auth (10.7) will
   * eventually replace this with the logged-in account name. */
  defaultPlayerName?: string;
}

export function LobbyShell({
  onSelect,
  defaultPlayerName = 'Player',
}: LobbyShellProps) {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [matches, setMatches] = useState<LobbyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState(
    () => loadAuth()?.user.username ?? defaultPlayerName,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [numPlayers, setNumPlayers] = useState<1 | 2 | 3 | 4>(4);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await lobby.listMatches('settlement');
      // bgio returns `{ matches: [...] }`. Normalize player.id to a number
      // so SeatPicker's `occupied` map keys against `String(id)` cleanly.
      const list: LobbyMatch[] = res.matches.map((m) => ({
        matchID: m.matchID,
        players: (m.players ?? []).map((p) => ({
          id: Number(p.id),
          name: p.name,
        })),
      }));
      setMatches(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth) void refresh();
  }, [auth, refresh]);

  const onCreate = useCallback(async () => {
    setError(null);
    try {
      const created = await lobby.createMatch('settlement', { numPlayers });
      setSelected(created.matchID);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [numPlayers, refresh]);

  const onJoin = useCallback(
    async (seatID: string) => {
      if (!selected) return;
      setError(null);
      try {
        const joined = await lobby.joinMatch('settlement', selected, {
          playerID: seatID,
          playerName,
        });
        onSelect(selected, joined.playerID, joined.playerCredentials);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [selected, playerName, onSelect],
  );

  // 10.8 — Watch flow: clicking "Watch" mounts the game Client without
  // a playerID/credentials. The lobby just hands the matchID up; App
  // takes it from there.
  const onWatch = useCallback(
    (matchID: string) => {
      onSelect(matchID, null, null);
    },
    [onSelect],
  );

  // Auth gate (10.7): until a token is in `auth`, render the login UI.
  // Placed AFTER hooks so the hook order stays stable across renders
  // (rules-of-hooks).
  if (!auth) {
    return (
      <AuthForms
        onLogin={(token, user) => {
          const next: AuthState = { token, user };
          saveAuth(next);
          setPlayerName(user.username);
          setAuth(next);
        }}
      />
    );
  }

  const selectedMatch = selected
    ? matches.find((m) => m.matchID === selected) ?? null
    : null;

  // Convert the selected match's player list into the {seatID -> name|null}
  // shape SeatPicker wants. Bgio reports a fixed-length player slot array
  // sized to the match's numPlayers, so seats not yet joined come back as
  // entries without a name field.
  const occupied: Record<string, string | null> = {};
  if (selectedMatch) {
    for (const p of selectedMatch.players) {
      occupied[String(p.id)] = p.name ?? null;
    }
  }
  const selectedNumPlayers: 1 | 2 | 3 | 4 = selectedMatch
    ? ((selectedMatch.players.length || 4) as 1 | 2 | 3 | 4)
    : 4;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: (t) => t.palette.card.surface,
        color: (t) => t.palette.card.text,
        width: 'min(100%, 36rem)',
        display: 'grid',
        gap: 2,
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Settlement — Lobby
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          label="Player name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          sx={{ flex: 1 }}
        />
        <Select
          size="small"
          value={numPlayers}
          onChange={(e) => setNumPlayers(Number(e.target.value) as 1 | 2 | 3 | 4)}
          aria-label="Number of players for new match"
        >
          {[1, 2, 3, 4].map((n) => (
            <MenuItem key={n} value={n}>
              {n}p
            </MenuItem>
          ))}
        </Select>
        <Button variant="contained" onClick={onCreate}>
          Create Match
        </Button>
        <Button onClick={refresh} variant="outlined">
          Refresh
        </Button>
      </Stack>

      {error ? (
        <Typography sx={{ color: (t) => t.palette.eventColor.red.main }}>
          {error}
        </Typography>
      ) : null}

      {loading ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Loading matches…</Typography>
        </Stack>
      ) : (
        <Stack spacing={1} aria-label="Match list">
          {matches.length === 0 ? (
            <Typography
              variant="body2"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              No matches yet — create one to get started.
            </Typography>
          ) : (
            matches.map((m) => {
              const filled = m.players.filter((p) => p.name).length;
              const total = m.players.length;
              const isSelected = selected === m.matchID;
              return (
                <Stack
                  key={m.matchID}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'stretch' }}
                >
                  <Button
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => setSelected(m.matchID)}
                    sx={{
                      flex: 1,
                      justifyContent: 'space-between',
                      textTransform: 'none',
                    }}
                  >
                    <Box component="span">{m.matchID}</Box>
                    <Box component="span">{`${filled}/${total} joined`}</Box>
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => onWatch(m.matchID)}
                    aria-label={`Watch match ${m.matchID}`}
                  >
                    Watch
                  </Button>
                </Stack>
              );
            })
          )}
        </Stack>
      )}

      {selectedMatch ? (
        <SeatPicker
          numPlayers={selectedNumPlayers}
          occupied={occupied}
          onJoin={onJoin}
        />
      ) : null}
    </Paper>
  );
}

export default LobbyShell;
