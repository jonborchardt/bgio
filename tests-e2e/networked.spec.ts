// Issue 025 — networked end-to-end smoke. The hot-seat fuzz spec
// (`smoke.spec.ts`) only exercises the in-browser bundle; this spec
// drives the bgio Koa server's REST surface directly via Playwright's
// `request` API. Covers:
//   - /auth/register + /auth/login + /auth/verify round-trip
//   - lobby createMatch
//   - lobby joinMatch (two users, same match)
//   - playerCredentials returned by joinMatch
//
// SocketIO transport convergence (state updates as moves are made) is
// still deferred: that needs a real browser tab + a websocket dance,
// and the headless `tests/server/botTakeover.test.ts` already exercises
// the Master.onUpdate path through the storage adapter — which is the
// transport-independent side of the same wiring.
//
// To run only this spec: `npx playwright test networked`. Requires
// the bgio server on :8000 (started by `npm run dev:full`).

import { test, expect } from '@playwright/test';

const SERVER = 'http://localhost:8000';

test.describe('networked smoke (issue 025)', () => {
  test('auth register → login → verify round-trip', async ({ request }) => {
    // Date-derived username so the ESLint no-Math.random rule
    // (game-state determinism guard) isn't tripped — this test
    // fixture isn't game state, but the rule is repo-wide. Base-36
    // keeps the username under the server's 20-char USERNAME_RE cap;
    // the decimal form (`Date.now()`) on its own is 13 chars and the
    // `e2e-…-…` decoration pushed past 20.
    const username = `e2e-${Date.now().toString(36)}`;
    const password = 'good-password-1234';

    const reg = await request.post(`${SERVER}/auth/register`, {
      data: { username, password },
    });
    expect(reg.ok()).toBe(true);

    const log = await request.post(`${SERVER}/auth/login`, {
      data: { username, password },
    });
    expect(log.ok()).toBe(true);
    const { token } = (await log.json()) as { token: string };
    expect(token).toBeTruthy();

    const ver = await request.get(`${SERVER}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ver.ok()).toBe(true);
    const verBody = (await ver.json()) as { user: { username: string } };
    expect(verBody.user.username).toBe(username);
  });

  test('lobby: createMatch + joinMatch from two seats returns playerCredentials', async ({
    request,
  }) => {
    const create = await request.post(
      `${SERVER}/games/settlement/create`,
      { data: { numPlayers: 4 } },
    );
    expect(create.ok()).toBe(true);
    const { matchID } = (await create.json()) as { matchID: string };
    expect(matchID).toBeTruthy();

    // Two seats join the same match. bgio mints `playerCredentials`
    // each time — the auth hook (issue 002) gates moves on these.
    const joinA = await request.post(
      `${SERVER}/games/settlement/${matchID}/join`,
      { data: { playerID: '0', playerName: 'alice' } },
    );
    expect(joinA.ok()).toBe(true);
    const a = (await joinA.json()) as { playerCredentials: string };
    expect(a.playerCredentials).toBeTruthy();

    const joinB = await request.post(
      `${SERVER}/games/settlement/${matchID}/join`,
      { data: { playerID: '1', playerName: 'bob' } },
    );
    expect(joinB.ok()).toBe(true);
    const b = (await joinB.json()) as { playerCredentials: string };
    expect(b.playerCredentials).toBeTruthy();
    expect(a.playerCredentials).not.toBe(b.playerCredentials);
  });

  test('rejects auth attempts on a wrong password', async ({ request }) => {
    const username = `wrong-${Date.now()}`;
    await request.post(`${SERVER}/auth/register`, {
      data: { username, password: 'right-password-1234' },
    });
    const bad = await request.post(`${SERVER}/auth/login`, {
      data: { username, password: 'WRONG-password' },
    });
    expect(bad.ok()).toBe(false);
    expect(bad.status()).toBe(400);
  });
});
