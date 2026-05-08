# 05 — Acceptance: smoke the live combo end-to-end

**Severity**: high (the only thing that proves 01–04 actually work)
**Area**: ops / qa
**Effort**: small (manual smoke, ~15 min) → medium (automated smoke
in CI, deferrable to issue 025)
**Status**: not started — runs after 01–04 land

## What this plan covers

Verify that — after plans 01 (stale-creds), 02 (connection-recovery),
03 (persistence), 04 (fill-empty-with-bots) all land — the live
deploy supports a real playtest end-to-end without surprises. This
is the gate for editing CLAUDE.md to drop the "networked playtest is
unverified" caveat.

The 16 manual steps from `plans/lobby/04-acceptance-and-smoke.md`
remain the basis. This plan adds steps that exercise the new
behavior.

## Manual smoke (do all of these on the live combo)

### Phase 1: from `plans/lobby/04-acceptance-and-smoke.md`

Steps 1–16 in the lobby acceptance plan. Every step must still pass.
The interesting ones to re-verify (because the underlying behavior
changed):

- **Step 1 (cold open)**: visit the live URL on a clean profile.
  Confirm the lobby renders with auth gate. Account from previous
  session is gone if plan 03 picked option A (free tier); present
  if option B (Starter). EITHER way, no stuck "connecting…".
- **Steps 6–9 (two-human play)**: same as before. Validates the
  PR #13 fix is in place (no stuck "connecting…" for player 2).
- **Step 11 (no-op redeploy)**: with plan 03 option B, both
  browsers' matches survive. With option A, both browsers should
  see the new "session expired" fall-through (plan 01) instead of
  stuck on the now-dead match.
- **Step 13 (#hotseat escape hatch)**: still works.

### Phase 2: new behaviors from this plan group

**17. Stale-creds recovery (plan 01)**:
   - Register `alice` on browser A; create a match; join seat 0.
   - On the Render dashboard, manually restart the service (Settings →
     Manual Deploy → Clear cache & deploy).
   - Refresh browser A → expect: bounced to the auth screen with the
     persisted creds cleared. NOT a stuck "connecting…".

**18. Connection recovery (plan 02)**:
   - With Render service warm, register a user and join a match.
   - Open DevTools → Network tab → throttle to "Offline".
   - Reload the page → expect: "Connecting…" → after ~3s,
     "Retry now" + "Back to lobby" buttons appear.
   - Set Network back to "Online" → click "Retry now" → expect:
     match resumes.
   - Click "Back to lobby" instead → expect: lands on lobby with
     creds cleared.

**19. Persistence (plan 03)**:
   - With option B (Starter):
     - Register `alice`, create a match.
     - Push a no-op deploy (touch any `server/*` file, push to
       main).
     - After Render redeploys, log back in as alice → expect: same
       account, same match still listed.
   - With option A (free tier):
     - Wait 20 minutes of idle on the Render service.
     - Refresh the lobby → expect: account is gone (need to
       re-register), match list is empty. The banner from plan 03
       option A should remind you of this.

**20. Fill-with-bots (plan 04)**:
   - Register `alice`, create a 4p match (Solo OFF).
   - Join seat 0.
   - Match listing in the lobby shows "Fill empty with bots" button.
   - Click it → seats 1–3 fill with "Bot 1" / "Bot 2" / "Bot 3".
   - Game starts. Bots dispatch moves (verify by watching the round
     counter advance).
   - On a different browser profile, register `bob` and try to take
     a "Bot N" seat → expect: bob can join, bot revokes, bob plays.
     (PR #13's revoke logic.)

If all 20 steps pass on the live combo, networked playtest is
shippable.

## Automated networked smoke (deferrable to issue 025)

The hot-seat smoke at `tests/e2e/smoke.spec.ts` already runs.
Networked smoke would:
- Spin up `npm run server:dev` on `STORAGE_KIND=memory` against a
  fresh port.
- Build the client with `VITE_SERVER_URL=http://localhost:8000`.
- Open three Playwright contexts (alice, bob, watcher).
- Drive: register → create match → join → fill bots → play one
  round → spectator joins → restart server → verify recovery (or
  graceful failure for option A).
- Assert state on all three contexts.

Issue 025 already tracks this. Deferring until the manual smoke
runs cleanly twice in a row — no point automating something we're
still iterating on.

## CLAUDE.md updates

After all 20 manual steps pass, edit
[CLAUDE.md](../../CLAUDE.md):

- "Known V1 caveats / open follow-ups": remove or rephrase the
  "Networked playtest is still unverified end-to-end" bullet to
  "Networked playtest verified end-to-end on YYYY-MM-DD with N
  humans + M bots; live URL: ..."
- If plan 03 picked option B: also remove the "Free-tier in-memory
  storage in production" bullet, and revert the "Storage state,
  current reality" paragraph in the Deployment section to the
  SQLite description.

## Acceptance

- All 16 lobby plan steps pass + the 4 new ones above (steps
  17–20).
- CLAUDE.md updated to reflect the verified state.
- A short note in this plan's PR description (or a follow-up
  commit) records the manual-smoke pass with the date.

## Risks / open questions

- **Manual smoke takes ~30 min on Starter tier (no cold-start
  waits) or ~45 min on free tier (you'll wait for at least one
  cold-start cycle to validate plan 01).** Plan accordingly.
- **Render manual restart**: requires dashboard access. If you
  don't have that during smoke, push a no-op commit instead —
  same effect, just slower (~2 min image rebuild).
- **Two-network requirement**: most steps work on a single LAN.
  The "spectator from a third network" check is a nice-to-have
  but not load-bearing for V1.

## Related

- `plans/lobby/04-acceptance-and-smoke.md` — the parent plan whose
  16 steps this one extends.
- issue 025 — automated networked smoke. Lands after manual smoke
  is stable.
- CLAUDE.md "Known V1 caveats" — gets edited based on the result.
