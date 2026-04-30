// @vitest-environment node
//
// 10.7 — passwordHash unit tests.
//
// We exercise the `scrypt$<salt>$<hash>` format and round-trip through
// `verifyPassword`. The Node `node` env keeps `crypto.scrypt` real;
// jsdom would still work but `node` is closer to the production runtime.

import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  verifyPassword,
} from '../../server/auth/passwordHash.ts';

describe('passwordHash (10.7)', () => {
  it('hashPassword produces the documented `scrypt$<salt>$<hash>` format', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const parts = stored.split('$');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('scrypt');
    // 16-byte salt -> 32 hex chars; 64-byte key -> 128 hex chars.
    expect(parts[1]).toHaveLength(32);
    expect(parts[2]).toHaveLength(128);
  });

  it('verifyPassword returns true for the original password', async () => {
    const password = 'super-secret-1234';
    const stored = await hashPassword(password);
    expect(await verifyPassword(password, stored)).toBe(true);
  });

  it('verifyPassword returns false for the wrong password', async () => {
    const stored = await hashPassword('right-password');
    expect(await verifyPassword('wrong-password', stored)).toBe(false);
  });

  it('verifyPassword returns false for malformed hash strings', async () => {
    expect(await verifyPassword('anything', '')).toBe(false);
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', 'scrypt$only-one-part')).toBe(
      false,
    );
    expect(
      await verifyPassword('anything', 'argon2$abc$def'), // wrong prefix
    ).toBe(false);
  });

  it('two hashes of the same password differ (random salt)', async () => {
    const a = await hashPassword('same-input');
    const b = await hashPassword('same-input');
    expect(a).not.toBe(b);
    // …but both verify against the original.
    expect(await verifyPassword('same-input', a)).toBe(true);
    expect(await verifyPassword('same-input', b)).toBe(true);
  });
});
