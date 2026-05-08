# 02 — Connection-recovery: replace bgio's "connecting…" with a real loading shell

**Severity**: high (transient connection failures look identical to
real bugs; users have no way to know whether to wait or reload)
**Area**: client
**Effort**: small-medium (~50 lines + retry-loop logic + tests)
**Status**: not started

## Problem

bgio's React Client renders `<div className="bgio-loading">connecting...</div>`
while waiting for the initial state sync. That string is the only
loading affordance — no spinner, no timeout, no retry button, no error
message. If the SocketIO connection stalls (Render cold-start wake,
transient network blip, server crash, stale match state), the user
sits on "connecting..." indefinitely with no recourse.

The 10.6 plan ("server-down spinner") originally called for retry
intervals at 1s / 2s / 5s / 15s / 30s / 60s with a manual "retry now"
button. The current `App.tsx` placeholder is `useState(false)` for
`connecting` with a comment that the real implementation is deferred.

This plan completes 10.6.

## Files

- [src/App.tsx](../../src/App.tsx) — `NetworkedShell`. Replace the
  static `useState(false)` with a real connection-state machine.
- (new) `src/lobby/ConnectionShell.tsx` — wraps the bgio Client with
  a connection probe + retry UI. Replaces the bgio default
  `connecting…` div.
- [tests/lobby/credentials.test.ts](../../tests/lobby/credentials.test.ts)
  — has an `it.todo` for the retry-with-backoff loop. Add the real
  test alongside.

## Fix sketch

bgio's Client accepts a `loading` prop (a React component). Use this
to inject our own loading shell instead of the default:

```tsx
// In src/clientMode.ts's networkedClientFactory:
const NetworkedClient = Client({
  game: Settlement,
  board: SettlementBoard,
  numPlayers: 4,
  multiplayer: SocketIO({ server: getServerURL() }),
  loading: ConnectionShell,
  debug: false,
});
```

Then `<ConnectionShell>` is the affordance:

```tsx
const RETRIES = [1000, 2000, 5000, 15000, 30000, 60000];

export const ConnectionShell = () => {
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState(false);
  const elapsedMs = RETRIES.slice(0, attempt).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (done) return;
    const delay = RETRIES[attempt] ?? RETRIES[RETRIES.length - 1];
    const timer = setTimeout(() => {
      setAttempt((a) => Math.min(a + 1, RETRIES.length));
    }, delay);
    return () => clearTimeout(timer);
  }, [attempt, done]);

  return (
    <Stack spacing={1} sx={{ alignItems: 'center', p: 2 }}>
      <CircularProgress size={20} />
      <Typography variant="body2">
        Connecting{attempt > 0 ? ` (attempt ${attempt + 1})` : ''}…
      </Typography>
      {attempt >= 2 ? (
        <>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            The server may be cold-starting. This usually takes 10–30 seconds
            on the free tier.
          </Typography>
          <Button size="small" variant="outlined" onClick={() => window.location.reload()}>
            Retry now
          </Button>
          <Button size="small" onClick={() => {
            clearCreds();
            window.location.reload();
          }}>
            Back to lobby
          </Button>
        </>
      ) : null}
    </Stack>
  );
};
```

A few notes on the design:

- `loading` is a bgio Client prop — once the Client has the initial
  state, it unmounts `<ConnectionShell>` and renders the board. So
  the retries here are about ELAPSED time on the loading screen,
  not about literal SocketIO retry semantics — those happen inside
  bgio's transport. The user-visible affordance is "after N seconds
  on this screen, surface a way out".
- "Retry now" is a hard reload because we don't have direct access
  to bgio's transport. Reload re-mounts everything cleanly.
- "Back to lobby" calls `clearCreds()` + reload → falls through to
  `<LobbyShell>`. This is the escape hatch when even retry doesn't
  work.

## Tests

Add to `tests/lobby/credentials.test.ts` (or a new file):

```ts
it("ConnectionShell shows retry UI after the second attempt window", async () => {
  vi.useFakeTimers();
  render(<ConnectionShell />);
  // First attempt: just spinner.
  expect(screen.getByText(/Connecting/)).toBeInTheDocument();
  expect(screen.queryByText('Retry now')).not.toBeInTheDocument();
  // Advance past the 1s + 2s waits.
  vi.advanceTimersByTime(3000);
  await waitFor(() => {
    expect(screen.getByText('Retry now')).toBeInTheDocument();
  });
});
```

## Acceptance

- A user who lands on a stuck networked session sees the spinner
  upgrade to "Retry now" + "Back to lobby" buttons within ~3
  seconds (after the 1s + 2s phases pass).
- "Retry now" fully reloads the page; if the server is now reachable,
  the next mount succeeds.
- "Back to lobby" clears the persisted creds and routes back to
  `<LobbyShell>`.
- A successful sync within the first second still shows zero retry
  affordances (the bgio Client unmounts the loading shell before any
  RETRIES fire).

## Risks / open questions

- **Render free-tier cold start is ~30s.** If the user opens the
  page during a cold wake, they hit RETRIES[2] / RETRIES[3] before
  the server responds. The "this is normal cold-start" caption
  reassures them.
- **The `loading` prop is documented in bgio.** `Client({ loading })`
  is the supported integration point — no need to hand-roll. Verify
  the prop name in the installed bgio version (it was `loading` in
  0.50.x).
- **Bgio versions before ~0.49 may not unmount `loading` cleanly.**
  Doesn't apply to us — package.json pins 0.50.x.
- **Logging a real error**: if the bgio Client errors out (rather
  than just hanging on sync), we'd want to surface that. The
  `loading` prop only covers the pre-sync state; once mounted, errors
  go through bgio's own error machinery. Out of scope here.

## Related

- 01 (stale-creds) — pre-mount probe; handles "creds are invalid
  before the connect attempt". 02 here handles "the connect attempt
  itself stalled".
- 03 (persistence) — Starter tier eliminates the most common
  cold-start wake; this plan still useful for transient network
  issues.
