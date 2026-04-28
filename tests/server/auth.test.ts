// @vitest-environment node
//
// 10.7 — accounts module tests.
//
// In-memory store: each test wipes it via `__resetAccountsForTest`.
// The token-rotation branch is exercised via `__backdateTokenForTest`
// — we shift `issuedAt` past the 1h threshold rather than waiting.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  __backdateTokenForTest,
  __resetAccountsForTest,
  login,
  register,
  verify,
} from '../../server/auth/accounts.ts';

beforeEach(() => {
  __resetAccountsForTest();
});

describe('accounts.register (10.7)', () => {
  it('creates a user with a uuid and a preserved-case username', async () => {
    const u = await register('Alice', 'hunter2hunter2');
    expect(u.username).toBe('Alice');
    expect(typeof u.id).toBe('string');
    expect(u.id.length).toBeGreaterThan(0);
    expect(u.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('rejects a duplicate username (case-insensitive)', async () => {
    await register('Alice', 'hunter2hunter2');
    await expect(register('alice', 'differentpw1')).rejects.toThrow(
      /already taken/i,
    );
    await expect(register('ALICE', 'differentpw1')).rejects.toThrow(
      /already taken/i,
    );
  });

  it('rejects bad usernames (length, characters)', async () => {
    await expect(register('ab', 'longenough1')).rejects.toThrow();
    await expect(
      register('a'.repeat(21), 'longenough1'),
    ).rejects.toThrow();
    await expect(register('has space', 'longenough1')).rejects.toThrow();
    await expect(register('emoji_🦄', 'longenough1')).rejects.toThrow();
  });

  it('rejects passwords shorter than 8 chars', async () => {
    await expect(register('valid_user', 'short')).rejects.toThrow();
  });

  it('trims whitespace on the username', async () => {
    const u = await register('  bob  ', 'hunter2hunter2');
    expect(u.username).toBe('bob');
  });
});

describe('accounts.login (10.7)', () => {
  it('returns the user + a token on the right password', async () => {
    await register('charlie', 'goodpassword');
    const result = await login('charlie', 'goodpassword');
    expect(result.user.username).toBe('charlie');
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('login is case-insensitive on username', async () => {
    await register('Dave', 'goodpassword');
    const result = await login('DAVE', 'goodpassword');
    expect(result.user.username).toBe('Dave');
  });

  it('rejects an incorrect password', async () => {
    await register('eve', 'goodpassword');
    await expect(login('eve', 'wrongpassword')).rejects.toThrow();
  });

  it('rejects an unknown username (same error as wrong password — no enumeration)', async () => {
    await expect(login('nobody', 'goodpassword')).rejects.toThrow(
      /invalid credentials/i,
    );
  });
});

describe('accounts.verify (10.7)', () => {
  it('returns the user for a fresh token', async () => {
    await register('frank', 'goodpassword');
    const { token } = await login('frank', 'goodpassword');
    const result = await verify(token);
    expect(result.user?.username).toBe('frank');
    // No rotation when the token is fresh — same string back.
    expect(result.token).toBe(token);
  });

  it('returns user: null for an unknown token', async () => {
    const result = await verify('not-a-real-token');
    expect(result.user).toBeNull();
  });

  it('rotates the token when older than 1h', async () => {
    await register('grace', 'goodpassword');
    const { token } = await login('grace', 'goodpassword');
    // Backdate the issuedAt past the rotation threshold.
    const ok = __backdateTokenForTest(token, 2 * 60 * 60 * 1000); // 2h
    expect(ok).toBe(true);
    const result = await verify(token);
    expect(result.user?.username).toBe('grace');
    expect(result.token).not.toBe(token);
    // The freshly-rotated token must itself verify.
    const second = await verify(result.token);
    expect(second.user?.username).toBe('grace');
    // The original token must now be invalid.
    const stale = await verify(token);
    expect(stale.user).toBeNull();
  });

  it('returns user: null after the token has fully expired', async () => {
    await register('heidi', 'goodpassword');
    const { token } = await login('heidi', 'goodpassword');
    // Backdate past the 24h TTL.
    __backdateTokenForTest(token, 25 * 60 * 60 * 1000);
    const result = await verify(token);
    expect(result.user).toBeNull();
  });
});

describe('accounts — integration (10.7)', () => {
  it('register → login → verify round-trip', async () => {
    const created = await register('ivan', 'goodpassword');
    const { user, token } = await login('ivan', 'goodpassword');
    expect(user.id).toBe(created.id);
    const verified = await verify(token);
    expect(verified.user?.id).toBe(created.id);
  });

  it.todo(
    'live auth endpoints round-trip through createServer (requires server-side wiring of /auth/* routes)',
  );
});
