// Issue 002 — coverage for the bgio authenticateCredentials hook.
//
// The hook is called positionally as `(credentials, playerMetadata)` by
// bgio's Auth class. We verify the four behaviors documented in
// `server/auth/authenticateCredentials.ts`: human accept, human reject,
// bot bypass, and the dev-mode no-stored-credentials warning.

import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  authenticateCredentials,
  botCredentialsFor,
} from '../../server/auth/authenticateCredentials.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('authenticateCredentials', () => {
  it('accepts when submitted credentials match the stored token (human)', () => {
    const meta = { id: 0, credentials: 'token-abc' };
    expect(authenticateCredentials('token-abc', meta)).toBe(true);
  });

  it('rejects when the token is wrong', () => {
    const meta = { id: 0, credentials: 'token-abc' };
    expect(authenticateCredentials('wrong', meta)).toBe(false);
  });

  it('rejects when no playerMetadata is present', () => {
    expect(authenticateCredentials('token', undefined)).toBe(false);
  });

  it('honors the bot bypass when isBot=true and credentials match the bot pattern', () => {
    const meta = { id: 3, isBot: true, credentials: undefined };
    expect(authenticateCredentials(botCredentialsFor('3'), meta)).toBe(true);
  });

  it('rejects bot credentials when the seat is NOT flagged isBot', () => {
    const meta = { id: 3, isBot: false, credentials: 'real-token' };
    expect(authenticateCredentials(botCredentialsFor('3'), meta)).toBe(false);
  });

  it('rejects bot credentials targeting a different seat', () => {
    const meta = { id: 3, isBot: true };
    expect(authenticateCredentials(botCredentialsFor('1'), meta)).toBe(false);
  });

  it('warns and accepts in the dev-mode "no stored credentials" path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meta = { id: 0 };
    expect(authenticateCredentials(undefined, meta)).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });
});
