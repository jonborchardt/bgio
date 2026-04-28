// 10.7 — password hashing.
//
// **V1 deviation from the plan:** the plan calls for argon2id (via the
// `argon2` package, which is a native module compiled against libsodium).
// Our V1 server stack avoids extra native deps so the boot story stays
// "checkout, npm install, run" with no toolchain. We use Node's built-in
// `crypto.scrypt` instead — it's the same shape (memory-hard KDF, salted,
// configurable cost) and ships with Node, so this slice can land before
// 13.3 (the deploy/db slice that introduces SQLite + argon2 as real
// dependencies). Migration path: bump the format prefix from `scrypt$`
// to `argon2id$`, ship a one-time rehash-on-login, retire the old
// branch. The `verifyPassword` here is already format-aware so layering
// argon2 in is a small change.
//
// Format on disk: `scrypt$<saltHex>$<hashHex>`.
//   - 16-byte salt (32 hex chars)
//   - 64-byte derived key (128 hex chars)
//
// All operations are async (Node's scrypt has a sync flavor, but using
// the callback-based async one keeps the hash work off the event loop).

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_BYTES = 64;

const scryptAsync = (
  password: string,
  salt: Buffer,
  keylen: number,
): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

/** Hash a plaintext password and return the storage-shaped string.
 *
 * The format is self-describing so `verifyPassword` doesn't need any
 * out-of-band info. We deliberately don't expose the cost params — if
 * we ever bump them, the format prefix would change.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_BYTES);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
};

/** Constant-time verify against a stored hash string. Returns false for
 * any malformed input rather than throwing — wrong format is just
 * "doesn't match" from a caller's perspective. */
export const verifyPassword = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const saltHex = parts[1];
  const hashHex = parts[2];
  if (!saltHex || !hashHex) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) {
    return false;
  }
  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
};
