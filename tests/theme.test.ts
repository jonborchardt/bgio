// 09.4 — theme tokens.
//
// These tests cover three things:
//   1. Every documented per-domain palette key resolves to a
//      well-formed hex color (`#rrggbb` or `#rrggbbaa`). This catches
//      a ramp slot pointing at a stray named color or empty string.
//   2. Distinct resources resolve to distinct hexes — at least the
//      gold/wood pair, which is the canary for "did the wiring
//      collapse to a single color".
//   3. Module augmentation compiles — implicit. If the augmentation
//      were wrong, this file (which reads `theme.palette.resource`
//      etc. through the augmented types) wouldn't typecheck and the
//      vitest run would fail at compile time.

import { describe, expect, it } from 'vitest';
import { theme } from '../src/theme.ts';
import { RESOURCES } from '../src/game/resources/types.ts';
import type { Resource } from '../src/game/resources/types.ts';
import type { Role } from '../src/game/types.ts';
import type { EventColor } from '../src/data/events.ts';

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

const ROLES: readonly Role[] = ['chief', 'science', 'domestic', 'foreign'];
const TIERS: readonly ('beginner' | 'intermediate' | 'advanced')[] = [
  'beginner',
  'intermediate',
  'advanced',
];
const EVENT_COLORS: readonly EventColor[] = ['gold', 'blue', 'green', 'red'];

describe('theme palette tokens (09.4)', () => {
  it('every resource palette entry has a hex .main', () => {
    for (const r of RESOURCES) {
      const c = theme.palette.resource[r as Resource];
      expect(c.main, `resource.${r}.main`).toMatch(HEX);
      expect(c.light, `resource.${r}.light`).toMatch(HEX);
      expect(c.dark, `resource.${r}.dark`).toMatch(HEX);
      expect(c.contrastText, `resource.${r}.contrastText`).toMatch(HEX);
    }
  });

  it('every role palette entry has a hex .main', () => {
    for (const r of ROLES) {
      const c = theme.palette.role[r];
      expect(c.main, `role.${r}.main`).toMatch(HEX);
      expect(c.light, `role.${r}.light`).toMatch(HEX);
      expect(c.dark, `role.${r}.dark`).toMatch(HEX);
      expect(c.contrastText, `role.${r}.contrastText`).toMatch(HEX);
    }
  });

  it('every tier palette entry has a hex .main', () => {
    for (const t of TIERS) {
      const c = theme.palette.tier[t];
      expect(c.main, `tier.${t}.main`).toMatch(HEX);
      expect(c.light, `tier.${t}.light`).toMatch(HEX);
      expect(c.dark, `tier.${t}.dark`).toMatch(HEX);
      expect(c.contrastText, `tier.${t}.contrastText`).toMatch(HEX);
    }
  });

  it('every eventColor palette entry has a hex .main', () => {
    for (const c of EVENT_COLORS) {
      const pc = theme.palette.eventColor[c];
      expect(pc.main, `eventColor.${c}.main`).toMatch(HEX);
      expect(pc.light, `eventColor.${c}.light`).toMatch(HEX);
      expect(pc.dark, `eventColor.${c}.dark`).toMatch(HEX);
      expect(pc.contrastText, `eventColor.${c}.contrastText`).toMatch(HEX);
    }
  });

  it('resource.gold and resource.wood resolve to distinct hexes', () => {
    expect(theme.palette.resource.gold.main).not.toBe(
      theme.palette.resource.wood.main,
    );
  });

  it('preserves the existing card/status/appSurface tokens', () => {
    // Sanity: 09.4 only ADDS groups; pre-existing semantic tokens
    // (used by Board.tsx and main.tsx) must still resolve.
    expect(theme.palette.card.surface).toMatch(HEX);
    expect(theme.palette.card.takenSurface).toMatch(HEX);
    expect(theme.palette.status.active).toMatch(HEX);
    expect(theme.palette.status.muted).toMatch(HEX);
    expect(theme.palette.appSurface.base).toMatch(HEX);
  });
});
