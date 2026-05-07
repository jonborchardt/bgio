// Resolves which card-deck the build loads.
//
// Resolution order (first wins):
//   1. `import.meta.env.VITE_DECK` — env override, set at build time.
//      Used for A/B builds and CI matrices ("build the prod bundle with
//      deck X").
//   2. `card-decks/deck.config.json#active` — the committed default.
//   3. `card-decks/deck.config.json#default` — fallback if `active` is
//      missing / invalid.
//
// The env-var path is intentionally first so an A/B build can override the
// committed default without editing the config file (and re-committing it
// per branch).

import deckConfig from '../../card-decks/deck.config.json';

export interface DeckEntry {
  id: string;
  label: string;
  path: string;
}

export interface DeckConfig {
  active: string;
  default: string;
  decks: DeckEntry[];
}

const config = deckConfig as DeckConfig;

const VITE_DECK =
  // Vite injects `import.meta.env` at build time. In Node test runs (no
  // Vite), this object is undefined — we fall through to the config.
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DECK) ||
  undefined;

const findEntry = (id: string | undefined): DeckEntry | undefined =>
  id === undefined ? undefined : config.decks.find((d) => d.id === id);

const resolveActiveEntry = (): DeckEntry => {
  const fromEnv = findEntry(VITE_DECK);
  if (fromEnv !== undefined) return fromEnv;
  const fromActive = findEntry(config.active);
  if (fromActive !== undefined) return fromActive;
  const fromDefault = findEntry(config.default);
  if (fromDefault !== undefined) return fromDefault;
  throw new Error(
    `deckSelection: no valid deck found — config.active="${config.active}", ` +
      `config.default="${config.default}", VITE_DECK="${VITE_DECK ?? ''}". ` +
      `Available ids: ${config.decks.map((d) => d.id).join(', ')}`,
  );
};

export const ACTIVE_DECK: DeckEntry = resolveActiveEntry();

// Helper used by the loaders. Given an `import.meta.glob` result keyed by
// `/card-decks/<path>/<file>.json`, returns the entry for the active
// deck. Throws (with a clear error) if the active deck is missing the
// requested file — that's a content error, not a runtime regression.
export const pickFromGlob = <T>(
  globResult: Record<string, T>,
  fileName: string,
): T => {
  const key = `/card-decks/${ACTIVE_DECK.path}/${fileName}`;
  const entry = globResult[key];
  if (entry === undefined) {
    throw new Error(
      `deckSelection: deck "${ACTIVE_DECK.id}" is missing ${fileName}. ` +
        `Looked for "${key}" — available keys: ${Object.keys(globResult).join(', ')}`,
    );
  }
  return entry;
};
