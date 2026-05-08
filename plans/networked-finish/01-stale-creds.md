# 01 — Stale-creds detection: bounce dead sessions to login

**Severity**: high (this is the second most common stuck state after the
PR #13 bug, and on free-tier persistence it happens every ~15 min idle)
**Area**: client
**Effort**: small (~30 lines + a test)
**Status**: not started

## Problem

When the Render container recycles (deploy, ~15 min idle on free
tier, manual restart), `STORAGE_KIND=memory` wipes the in-memory
accounts store. But the user's browser still has a valid-looking
auth token + match credentials in `localStorage`. On their next
visit:

1. `<App>` mounts → `NetworkedShell` reads `loadCreds()` → finds the
   persisted `(matchID, playerID, credentials)` tuple.
2. `NetworkedShell` builds the bgio Client with those creds and
   mounts it.
3. The bgio Client connects to SocketIO and tries to sync.
4. Server has no record of the match → either silent hang or some
   bgio-internal error that doesn't surface to our UI.
5. User sees "connecting…" forever.

What the user expects: bounce them to login. The server doesn't
know them anymore — they need to register/login again.

There's a similar (less common) flavor: the auth token lives in
localStorage too. Even if the user isn't currently in a match, the
lobby's auth gate checks `verify()` on mount. Today, if `verify()`
fails or the request times out, the lobby may still mount its
authenticated shell with stale creds and then break on the first
real action.

## Files

- [src/lobby/authClient.ts](../../src/lobby/authClient.ts) — already
  has a `verify()` call. Probably exposes `/auth/verify` POST.
- [src/lobby/credentials.ts](../../src/lobby/credentials.ts) — owns
  `loadCreds`, `saveCreds`, `clearCreds`. We'll call `clearCreds()`
  from the new probe.
- [src/App.tsx](../../src/App.tsx) — `NetworkedShell`. Add the probe
  on first mount; if it fails, drop the persisted creds and re-render.

## Fix sketch

Two probes, one for each kind of stale state:

### A. Probe match credentials on networked-mount

In `NetworkedShell`, when `loadCreds()` returns a saved triple, **before**
mounting the bgio Client, hit a cheap REST endpoint to verify the match
+ credentials are still valid. bgio's `LobbyClient.getMatch(gameName,
matchID)` is the canonical "does this match exist" probe. If it 404s,
the match is gone — clear creds and fall through to the lobby.

```ts
const NetworkedShell = () => {
  const [match, setMatch] = useState<...>(...);
  const [probing, setProbing] = useState(true);

  useEffect(() => {
    if (!match) {
      setProbing(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await lobbyClient.getMatch('settlement', match.matchID);
        // bgio returns the match metadata. If the stored playerID isn't
        // listed (or has different credentials), our session is dead.
        const player = res.players?.find((p) => String(p.id) === match.playerID);
        if (!player) {
          throw new Error('seat not found');
        }
        // Credentials aren't returned by getMatch (bgio strips them).
        // The fact that the seat exists with a name is good enough —
        // a real auth failure will surface on the first move.
        if (!cancelled) setProbing(false);
      } catch {
        if (!cancelled) {
          clearCreds();
          setMatch(null);
          setProbing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [match]);

  if (probing) return <Spinner label="Resuming session…" />;
  // ... rest unchanged
};
```

### B. Probe auth token on lobby-mount

In `LobbyShell` (or wherever the auth-gated shell mounts), call
`verify(token)` once on first mount. If it fails:

- Clear the auth token from localStorage.
- Show `<AuthForms>` for re-login.

Most of this is probably already in place — `authClient.verify()` exists.
The gap is what happens on failure. Audit the existing flow:

```ts
// in the auth gate component (src/lobby/AuthGate.tsx or similar)
useEffect(() => {
  const token = loadAuthToken();
  if (!token) return;
  verify(token)
    .then((ok) => {
      if (!ok) {
        clearAuthToken();
        setAuthed(false);
      }
    })
    .catch(() => {
      clearAuthToken();
      setAuthed(false);
    });
}, []);
```

The exact code shape depends on what the existing AuthForms / LobbyShell
flow looks like. Audit before patching.

## Tests

Two new tests in [tests/lobby/credentials.test.ts](../../tests/lobby/credentials.test.ts)
or a new `tests/lobby/networkedShell.test.ts`:

1. **`getMatch` 404 clears creds**: mock `lobbyClient.getMatch` to
   throw; mount `<NetworkedShell>` with seeded creds; assert
   `clearCreds()` was called and the lobby renders.
2. **`getMatch` 200 keeps creds**: same setup but resolved success;
   assert the bgio Client mounts.

For the auth probe, similar pair against `verify()`.

## Acceptance

- After a Render cold-start that wipes the in-memory store:
  - User refreshes the live Pages site.
  - They land on the lobby's auth gate (NOT a stuck "connecting…").
  - localStorage no longer has a saved match-creds entry.
- New unit tests cover both the success and failure paths.

## Risks / open questions

- **Spectator path** (playerID null + credentials null). The seat
  check above would treat a spectator as "no seat found" and clear
  their creds. That's wrong — spectators don't have creds in the
  first place. Branch on `match.playerID === null` and skip the
  probe for spectators (they fall straight through).
- **bgio's `LobbyClient.getMatch` may not 404 cleanly.** If the
  storage adapter just returns an empty match shell on a missing
  match (no error thrown), the probe needs a different signal —
  e.g., check that `match.players` is non-empty.
- **The probe adds a round-trip to first-load.** ~50–500ms on the
  live deploy depending on cold-start. Show a different spinner
  ("Resuming session…") so the user knows something's happening.

## Related

- 02 (connection-recovery) — handles the LIVE-failure case. 01
  handles the PRE-mount stale-state case. Both needed.
- 03 (persistence) — Starter tier eliminates most of these wipes
  but doesn't help the "match was deleted" or "creds invalidated"
  cases. So 01 is still useful.
