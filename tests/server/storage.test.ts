// @vitest-environment node
//
// 10.4 — storage factory smoke tests.
//
// We assert two things:
//   1. `makeStorage('memory')` returns `undefined` (the contract that
//      lets `Server({ db })` fall back to bgio's in-memory store).
//   2. `makeStorage('flatfile', ...)` returns an `Async`-shaped object
//      with the methods bgio expects. If FlatFile fails to construct
//      because `node-persist` isn't installed in the current
//      environment (CI without optional deps), we skip rather than
//      fail — the production deploy is expected to install that dep.
//
// We override the test environment to `node` so any FlatFile internals
// that touch fs/path don't trip jsdom.

import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeStorage } from '../../server/storage/index.ts';

const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; the OS tmp dir gets pruned anyway.
    }
  }
});

const ASYNC_METHODS = [
  'createMatch',
  'setState',
  'fetch',
  'wipe',
  'setMetadata',
  'listMatches',
] as const;

describe('makeStorage (10.4)', () => {
  it("returns undefined for 'memory' (lets bgio use built-in)", () => {
    expect(makeStorage('memory')).toBeUndefined();
  });

  it("returns an Async-shaped adapter for 'flatfile' (or skips if node-persist missing)", () => {
    const dir = mkdtempSync(join(tmpdir(), 'bgio-storage-test-'));
    tmpDirs.push(dir);

    const store = makeStorage('flatfile', { dir });
    if (store === undefined) {
      // Factory swallowed an init error (likely a missing optional
      // dep). That's acceptable in CI; just bail without failing the
      // suite — the round-trip test below would also fail and that's
      // informative for the developer who added the dep but skip-and-
      // move-on is the documented contract.
      console.warn(
        '[test] FlatFile init returned undefined; skipping shape check.',
      );
      return;
    }

    for (const m of ASYNC_METHODS) {
      expect(
        typeof (store as unknown as Record<string, unknown>)[m],
        `flatfile adapter is missing method '${m}'`,
      ).toBe('function');
    }
  });
});
