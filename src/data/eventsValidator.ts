// Pure types + validator for event cards. Lives in its own file so the
// test fixture's events shim can import them without hitting the test
// alias on `src/data/events.ts` (which would create a circular alias).

import type { LibraryTier, LibraryColor } from './schema.ts';

export type EventColor = 'gold' | 'blue' | 'green' | 'red';

export interface EventCardDef {
  id: string;
  color: EventColor;
  name: string;
  // Loose at this stage. The dispatcher (08.2) defines the typed
  // `EventEffect` union and validates per-entry.
  effects: unknown[];
  // Science Library SL 1.1 — optional library tagging.
  tier?: LibraryTier;
  scienceColor?: LibraryColor;
}

const COLORS: ReadonlySet<EventColor> = new Set([
  'gold',
  'blue',
  'green',
  'red',
]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const validateEvents = (raw: unknown): EventCardDef[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`EventCardDef: expected an array, got ${typeof raw}`);
  }
  return raw.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `EventCardDef[${i}]: expected an object, got ${typeof entry}`,
      );
    }
    const id = entry.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(
        `EventCardDef[${i}]: field "id" must be a non-empty string`,
      );
    }
    const color = entry.color;
    if (typeof color !== 'string' || !COLORS.has(color as EventColor)) {
      throw new Error(
        `EventCardDef[${i}]: field "color" must be one of gold|blue|green|red, got ${String(color)}`,
      );
    }
    const name = entry.name;
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(
        `EventCardDef[${i}]: field "name" must be a non-empty string`,
      );
    }
    const effects = entry.effects;
    if (!Array.isArray(effects)) {
      throw new Error(
        `EventCardDef[${i}]: field "effects" must be an array`,
      );
    }
    const out: EventCardDef = {
      id,
      color: color as EventColor,
      name,
      // Copy so a downstream mutation can't reach back into the JSON
      // module. Frozen by the loader alongside the wrapping array.
      effects: [...effects],
    };
    const tierRaw = entry.tier;
    if (tierRaw !== undefined) {
      if (
        typeof tierRaw !== 'number' ||
        (tierRaw !== 1 && tierRaw !== 2 && tierRaw !== 3)
      ) {
        throw new Error(
          `EventCardDef[${i}]: field "tier" must be 1|2|3 when present, got ${String(tierRaw)}`,
        );
      }
      out.tier = tierRaw as LibraryTier;
    }
    const colorRaw = entry.scienceColor;
    if (colorRaw !== undefined) {
      if (
        typeof colorRaw !== 'string' ||
        (colorRaw !== 'gold' &&
          colorRaw !== 'blue' &&
          colorRaw !== 'green' &&
          colorRaw !== 'red')
      ) {
        throw new Error(
          `EventCardDef[${i}]: field "scienceColor" must be one of gold|blue|green|red when present, got ${String(colorRaw)}`,
        );
      }
      out.scienceColor = colorRaw as LibraryColor;
    }
    return out;
  });
};
