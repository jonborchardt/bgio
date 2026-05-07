// Pure validator + type for adjacency rules. Lives in its own file so
// the test fixture's adjacency shim can import the validator without
// hitting the test alias on `src/data/adjacency.ts` (which would create
// a circular alias).

import { RESOURCES } from '../game/resources/types.ts';
import type { ResourceBag } from '../game/resources/types.ts';

export interface AdjacencyRuleDef {
  defID: string;
  whenAdjacentTo: string | '*';
  bonus: Partial<ResourceBag>;
  flavor?: string;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const VALID_RESOURCES: ReadonlySet<string> = new Set(RESOURCES);

const validateBonus = (raw: unknown, index: number): Partial<ResourceBag> => {
  if (!isPlainObject(raw)) {
    throw new Error(
      `AdjacencyRuleDef[${index}]: field "bonus" must be an object, got ${typeof raw}`,
    );
  }
  const out: Partial<ResourceBag> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!VALID_RESOURCES.has(k)) {
      throw new Error(
        `AdjacencyRuleDef[${index}]: unknown resource "${k}" in bonus (allowed: ${[...RESOURCES].join(', ')})`,
      );
    }
    if (typeof v !== 'number' || Number.isNaN(v)) {
      throw new Error(
        `AdjacencyRuleDef[${index}]: bonus."${k}" must be a number, got ${typeof v}`,
      );
    }
    (out as Record<string, number>)[k] = v;
  }
  return out;
};

export const validateAdjacencyRules = (
  raw: unknown,
  knownBuildings: ReadonlySet<string>,
): AdjacencyRuleDef[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`AdjacencyRuleDef: expected an array, got ${typeof raw}`);
  }
  return raw.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `AdjacencyRuleDef[${i}]: expected an object, got ${typeof entry}`,
      );
    }

    const defID = entry['defID'];
    if (typeof defID !== 'string') {
      throw new Error(
        `AdjacencyRuleDef[${i}]: field "defID" must be a string, got ${typeof defID}`,
      );
    }
    if (!knownBuildings.has(defID)) {
      throw new Error(
        `AdjacencyRuleDef[${i}]: defID "${defID}" does not match any building name in BUILDINGS`,
      );
    }

    const whenAdjacentTo = entry['whenAdjacentTo'];
    if (typeof whenAdjacentTo !== 'string') {
      throw new Error(
        `AdjacencyRuleDef[${i}]: field "whenAdjacentTo" must be a string, got ${typeof whenAdjacentTo}`,
      );
    }
    if (whenAdjacentTo !== '*' && !knownBuildings.has(whenAdjacentTo)) {
      throw new Error(
        `AdjacencyRuleDef[${i}]: whenAdjacentTo "${whenAdjacentTo}" does not match any building name in BUILDINGS`,
      );
    }

    const bonus = validateBonus(entry['bonus'], i);

    const flavorRaw = entry['flavor'];
    if (flavorRaw !== undefined && typeof flavorRaw !== 'string') {
      throw new Error(
        `AdjacencyRuleDef[${i}]: optional field "flavor" must be a string when present, got ${typeof flavorRaw}`,
      );
    }

    const out: AdjacencyRuleDef = { defID, whenAdjacentTo, bonus };
    if (typeof flavorRaw === 'string') out.flavor = flavorRaw;
    return out;
  });
};
