// 10.7 — login + register forms.
//
// Lives in front of `<LobbyShell>`: until the user provides a valid
// token, the lobby renders this component instead of the match list.
//
// We keep the UI minimal — two MUI tabs (Login / Register), a username
// + password field, a submit button. Validation errors from the auth
// client are shown inline. Successful login bubbles `{token, user}` up
// to the parent via `onLogin`, which is responsible for persisting the
// token (LocalStorage / cookie) and re-rendering.

import { useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import * as authClient from './authClient.ts';

type Mode = 'login' | 'register';

export interface AuthFormsProps {
  /** Fired after a successful login (or register-then-login). The
   * parent persists the token and switches to the lobby view. */
  onLogin: (token: string, user: { id: string; username: string }) => void;
}

export function AuthForms({ onLogin }: AuthFormsProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        // Register then immediately log in. The server has no
        // session-on-register flow today (`POST /auth/register`
        // returns the user only) — login mints the token.
        await authClient.register(username, password);
        const result = await authClient.login(username, password);
        onLogin(result.token, {
          id: result.user.id,
          username: result.user.username,
        });
      } else {
        const result = await authClient.login(username, password);
        onLogin(result.token, {
          id: result.user.id,
          username: result.user.username,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: (t) => t.palette.card.surface,
        color: (t) => t.palette.card.text,
        width: 'min(100%, 24rem)',
        display: 'grid',
        gap: 2,
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Settlement
      </Typography>
      <Tabs
        value={mode}
        onChange={(_, v) => {
          setMode(v as Mode);
          setError(null);
        }}
        aria-label="Auth mode"
      >
        <Tab value="login" label="Login" />
        <Tab value="register" label="Register" />
      </Tabs>
      <Box component="form" onSubmit={onSubmit} aria-label={`${mode} form`}>
        <Stack spacing={2}>
          <TextField
            size="small"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <TextField
            size="small"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {error ? (
            <Typography
              variant="body2"
              sx={{ color: (t) => t.palette.eventColor.red.main }}
            >
              {error}
            </Typography>
          ) : null}
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? (
              <CircularProgress size={20} />
            ) : mode === 'login' ? (
              'Log in'
            ) : (
              'Create account'
            )}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

export default AuthForms;
