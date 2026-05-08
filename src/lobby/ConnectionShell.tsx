// Connection-recovery loading shell (plan 02 of plans/networked-finish/).
//
// bgio's React `Client` accepts a `loading` prop — a component shown
// while the initial state sync is pending. The default is just
// `<div>connecting...</div>`, which sits forever if the SocketIO
// connection stalls (Render free-tier cold-start wake, transient
// network blip, server crash, stale match state). This component
// replaces it with a recovery UI that surfaces a way out:
//
//   timeline (relative to mount):
//     0–1s      spinner only ("Connecting…")
//     1–3s      "Connecting (attempt 2)…" — first backoff window
//     3s+       "Retry now" + "Back to lobby" buttons appear; a
//               short cold-start hint explains the wait window.
//
// The bgio Client unmounts `loading` as soon as the sync completes,
// so a successful first-second connect shows zero retry affordances —
// only stuck connections see them.
//
// "Retry now" hard-reloads the page. The bgio Client doesn't expose
// a manual-reconnect API from the loading prop; reload re-mounts
// transport + sync cleanly. "Back to lobby" clears the persisted
// match creds first so the reload doesn't re-mount the same stuck
// session. (Stale-creds detection in plan 01 is the complementary
// case — it catches dead sessions BEFORE the connect attempt; this
// catches them DURING.)

import { useEffect, useState, type ReactElement } from 'react';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import { clearCreds } from './credentials.ts';

/** Backoff intervals (ms) governing the loading-shell phase
 * transitions. After each interval elapses on the same mount, the
 * `attempt` counter increments and the UI re-renders with the next
 * phase. The Client unmounting the shell mid-sequence (because sync
 * completed) cancels the pending timer via the cleanup function. */
// eslint-disable-next-line react-refresh/only-export-components
export const RETRY_DELAYS_MS = [1000, 2000, 5000, 15000, 30000, 60000];

/** Number of phase transitions before the recovery buttons appear.
 * `attempt >= RETRY_BUTTON_THRESHOLD` shows the buttons. The default
 * 2 puts them at the 3-second mark (1s + 2s). */
export const RETRY_BUTTON_THRESHOLD = 2;

export const ConnectionShell = (): ReactElement => {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt >= RETRY_DELAYS_MS.length) return;
    const delay = RETRY_DELAYS_MS[attempt];
    const timer = setTimeout(() => {
      setAttempt((a) => a + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [attempt]);

  const showRetry = attempt >= RETRY_BUTTON_THRESHOLD;

  const onRetry = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const onBackToLobby = (): void => {
    clearCreds();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <Stack
      spacing={1}
      sx={{ alignItems: 'center', p: 2 }}
      aria-label="Connecting to game"
    >
      <CircularProgress size={20} />
      <Typography variant="body2">
        {attempt === 0
          ? 'Connecting…'
          : `Connecting (attempt ${attempt + 1})…`}
      </Typography>
      {showRetry ? (
        <>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              maxWidth: '24rem',
            }}
          >
            The server may be cold-starting. On Render's free tier,
            the first request after ~15 minutes of idle takes about
            30 seconds.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={onRetry}>
              Retry now
            </Button>
            <Button size="small" onClick={onBackToLobby}>
              Back to lobby
            </Button>
          </Stack>
        </>
      ) : null}
    </Stack>
  );
};

export default ConnectionShell;
