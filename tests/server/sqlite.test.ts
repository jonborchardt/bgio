// @vitest-environment node
//
// 13.3 — SQLite adapter smoke tests.
//
// We import the adapter module so a typecheck regression surfaces here even
// when `better-sqlite3` isn't installed. The actual round-trip test is
// gated on the native dep loading — if the require throws we mark the
// suite skipped rather than failing CI on machines that haven't run
// `npm install better-sqlite3` yet (the V1 plan ships configs but defers
// the install step to deploy).

import { describe, expect, it } from 'vitest';

// Importing the module is safe on machines without the native dep — the
// adapter only loads better-sqlite3 inside its constructor, not at module
// load. So this import never throws.
import { SqliteStorage, makeSqliteStorage } from '../../server/storage/sqlite.ts';
import { makeStorage } from '../../server/storage/index.ts';

/** Try to construct a `:memory:` instance. Returns null if the native dep
 * isn't available so the caller can soft-skip. */
const tryConstruct = (): SqliteStorage | null => {
  try {
    return new SqliteStorage({ path: ':memory:' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('better-sqlite3')) return null;
    throw err;
  }
};

describe('SQLite storage adapter (13.3)', () => {
  it('module exports load without throwing', () => {
    // Just importing + binding the names is the assertion.
    expect(typeof SqliteStorage).toBe('function');
    expect(typeof makeSqliteStorage).toBe('function');
  });

  it('round-trips a match through createMatch / fetch / setState / wipe', async () => {
    const store = tryConstruct();
    if (store === null) {
      console.warn(
        '[test] better-sqlite3 not installed; skipping round-trip test.',
      );
      return;
    }

    await store.createMatch('m1', {
      initialState: { foo: 'bar' },
      metadata: { gameName: 'settlement' },
    });

    const fetched = await store.fetch('m1', {
      state: true,
      metadata: true,
      initialState: true,
    });
    expect(fetched.state).toEqual({ foo: 'bar' });
    expect(fetched.metadata).toEqual({ gameName: 'settlement' });
    expect(fetched.initialState).toEqual({ foo: 'bar' });

    await store.setState('m1', { foo: 'baz' }, [{ type: 'MAKE_MOVE' }]);
    const after = await store.fetch('m1', { state: true, log: true });
    expect(after.state).toEqual({ foo: 'baz' });
    expect(after.log).toEqual([{ type: 'MAKE_MOVE' }]);

    await store.setMetadata('m1', { gameName: 'settlement', updated: true });
    const meta = await store.fetch('m1', { metadata: true });
    expect(meta.metadata).toEqual({ gameName: 'settlement', updated: true });

    const ids = await store.listMatches();
    expect(ids).toContain('m1');

    await store.wipe('m1');
    const gone = await store.fetch('m1', { state: true });
    expect(gone.state).toBeUndefined();

    await store.disconnect();
  });

  it('appends multiple log batches in order', async () => {
    const store = tryConstruct();
    if (store === null) return;

    await store.createMatch('m2', {
      initialState: {},
      metadata: {},
    });
    await store.setState('m2', { v: 1 }, [{ idx: 0 }]);
    await store.setState('m2', { v: 2 }, [{ idx: 1 }, { idx: 2 }]);

    const fetched = await store.fetch('m2', { log: true, state: true });
    expect(fetched.log).toEqual([{ idx: 0 }, { idx: 1 }, { idx: 2 }]);
    expect(fetched.state).toEqual({ v: 2 });

    await store.disconnect();
  });

  it("makeStorage('sqlite', ...) returns either a SQLite adapter or undefined (fallback)", () => {
    const store = makeStorage('sqlite', { sqlitePath: ':memory:' });
    if (store === undefined) {
      // Native dep missing — factory's documented fallback to memory
      // (with a console.warn). That's acceptable; nothing to assert.
      return;
    }
    // Smoke-check the Async-shape methods are present.
    const ASYNC_METHODS = [
      'createMatch',
      'setState',
      'fetch',
      'wipe',
      'setMetadata',
      'listMatches',
    ] as const;
    for (const m of ASYNC_METHODS) {
      expect(
        typeof (store as unknown as Record<string, unknown>)[m],
        `sqlite adapter is missing method '${m}'`,
      ).toBe('function');
    }
  });
});
