import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectMode, getServerURL } from '../src/clientMode.ts';

describe('detectMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 'hotseat' when VITE_CLIENT_MODE is unset", () => {
    vi.stubEnv('VITE_CLIENT_MODE', '');
    expect(detectMode()).toBe('hotseat');
  });

  it("returns 'hotseat' when VITE_CLIENT_MODE=hotseat", () => {
    vi.stubEnv('VITE_CLIENT_MODE', 'hotseat');
    expect(detectMode()).toBe('hotseat');
  });

  it("returns 'networked' when VITE_CLIENT_MODE=networked", () => {
    vi.stubEnv('VITE_CLIENT_MODE', 'networked');
    expect(detectMode()).toBe('networked');
  });

  it('returns hotseat for unknown values (defensive default)', () => {
    vi.stubEnv('VITE_CLIENT_MODE', 'banana');
    expect(detectMode()).toBe('hotseat');
  });
});

describe('getServerURL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to http://localhost:8000 when VITE_SERVER_URL is unset', () => {
    vi.stubEnv('VITE_SERVER_URL', '');
    expect(getServerURL()).toBe('http://localhost:8000');
  });

  it('honors a configured VITE_SERVER_URL', () => {
    vi.stubEnv('VITE_SERVER_URL', 'https://example.test');
    expect(getServerURL()).toBe('https://example.test');
  });
});

describe('App still boots in hot-seat mode', () => {
  it('imports App as a function (the React component returned by Client())', async () => {
    // Hot-seat is the default; this assertion mirrors the existing
    // tests/game.test.ts smoke check at the App level. If the new
    // clientMode wiring broke hot-seat, this import would throw or
    // produce a non-callable default export.
    vi.stubEnv('VITE_CLIENT_MODE', 'hotseat');
    const mod = await import('../src/App.tsx');
    expect(typeof mod.default).toBe('function');
  });
});
